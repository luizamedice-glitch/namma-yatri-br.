#!/usr/bin/env python3
"""Measure the historical compiler without changing application sources or dependencies."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import shutil
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[2]


def read(path):
    try:
        return Path(path).read_text().strip()
    except OSError:
        return None


def snapshot():
    return {name: read('/sys/fs/cgroup/' + name) for name in
            ('memory.max', 'memory.current', 'memory.peak', 'memory.events')}


def stop_group(process):
    """Stop descendants even when Spago exits before its compiler child."""
    try:
        os.killpg(process.pid, signal.SIGINT)
    except ProcessLookupError:
        process.wait()
        return
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        process.poll()
        try:
            os.killpg(process.pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.1)
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', choices=['passageiro', 'motorista'], default='passageiro')
    parser.add_argument('--compiler-version', choices=['0.15.4', '0.15.14'], default='0.15.4')
    parser.add_argument('--heap', default='2500m', help='GHC heap cap, not a Node/V8 setting')
    parser.add_argument('--label', default='build')
    parser.add_argument('--mode', choices=['full', 'module', 'staged'], default='full')
    parser.add_argument('--codegen', choices=['js', 'corefn'], default='js')
    parser.add_argument('--module', default='Resources.LocalizableV2.Strings')
    parser.add_argument('--batch-size', type=int, default=1)
    parser.add_argument('--warmup-module', action='append', default=[], help='Additional module closure to compile first')
    parser.add_argument('--no-default-warmup', action='store_true', help='Reproduce plain topological batches')
    parser.add_argument('--logs', type=Path, default=ROOT / 'purescript-diagnostics')
    parser.add_argument('--time-bin', default='/usr/bin/time')
    parser.add_argument('--timeout-seconds', type=int, default=1800, help='Time limit per compiler invocation')
    args = parser.parse_args()
    if not re.fullmatch(r'[1-9][0-9]*[mMgG]', args.heap):
        parser.error('--heap must be a positive integer followed by m or g')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', args.label) or min(args.batch_size, args.timeout_seconds) < 1:
        parser.error('invalid label or batch size')
    for binary, version in [('purs', args.compiler_version), ('spago', '0.21.0')]:
        actual = subprocess.check_output([binary, '--version'], text=True).strip()
        if actual != version:
            parser.error(f'{binary}: expected {version}, found {actual}')
    if not shutil.which(args.time_bin):
        parser.error('GNU time required (Debian/Ubuntu package: time)')
    limits = []
    mem_total = re.search(r'^MemTotal:\s+(\d+) kB', read('/proc/meminfo') or '', re.M)
    if mem_total:
        limits.append(int(mem_total.group(1)) * 1024)
    cgroup_max = read('/sys/fs/cgroup/memory.max')
    if cgroup_max and cgroup_max.isdigit():
        limits.append(int(cgroup_max))
    heap_bytes = int(args.heap[:-1]) * (1024 ** (2 if args.heap[-1].lower() == 'm' else 3))
    limit = min(limits) if limits else None
    reserve = max(1024 ** 3, limit // 5) if limit else None
    if limit and heap_bytes > limit - reserve:
        parser.error(f'heap exceeds memory budget: limit={limit} bytes, reserve={reserve}; choose a smaller --heap')
    app = ROOT / 'Frontend' / ('ui-customer' if args.app == 'passageiro' else 'ui-driver')
    logs = args.logs.resolve() / args.label
    logs.mkdir(parents=True, exist_ok=False)
    # Spago itself does not need the compiler heap. Compiler flags override this cap.
    env = dict(os.environ, GHCRTS='-N1 -M512m')
    compiler_args = ['--codegen', args.codegen, '+RTS', '-N1', '-M' + args.heap, '-s', '-RTS']
    metadata = {'app': args.app, 'compiler_version': args.compiler_version,
                'mode': args.mode, 'codegen': args.codegen, 'heap': args.heap,
                'started_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'purs': shutil.which('purs'), 'spago': shutil.which('spago'),
                'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                'memory_budget': {'limit_bytes': limit, 'reserve_bytes': reserve, 'heap_bytes': heap_bytes},
                'before': snapshot(), 'runs': []}
    (logs / 'free-before.txt').write_text(subprocess.check_output(['free', '-h'], text=True))
    sources = subprocess.check_output(['spago', 'sources'], cwd=app, env=env, text=True).splitlines()
    graph = json.loads(subprocess.check_output(['purs', 'graph', *sources], cwd=app, env=env, text=True))
    (logs / 'graph.json').write_text(json.dumps(graph, indent=2))
    # Record exact sources and resolved dependency bytes; branch dependencies can move.
    hashes = {n: hashlib.sha256((app / v['path']).read_bytes()).hexdigest() for n, v in graph.items()}
    (logs / 'source-hashes.json').write_text(json.dumps(hashes, indent=2, sort_keys=True))
    ordered, visited = [], set()

    def visit(name):
        if name in visited or name not in graph:
            return
        visited.add(name)
        for dep in sorted(graph[name]['depends']):
            visit(dep)
        ordered.append(name)

    if args.mode == 'module':
        if args.module not in graph:
            parser.error(f'module absent from graph: {args.module}')
        visit(args.module)
        commands = [['purs', 'compile', *compiler_args, *[graph[n]['path'] for n in ordered]]]
    elif args.mode == 'staged':
        warmups = [] if args.no_default_warmup else [
            name for name in ('Resources.LocalizableV2.Strings', 'Common.RemoteConfig.Utils') if name in graph]
        warmups = list(dict.fromkeys(warmups + args.warmup_module))
        ends = []
        for name in warmups:
            if name not in graph:
                parser.error(f'warmup module absent from graph: {name}')
            visit(name)
            if not ends or len(ordered) != ends[-1]:
                ends.append(len(ordered))
        warmup_count = len(ordered)
        metadata['warmup_modules'] = warmups
        for name in sorted(graph):
            visit(name)
        # Every batch includes its full dependency closure, retaining normal externs/cache.
        ends += list(range(warmup_count + args.batch_size, len(ordered), args.batch_size))
        if not ends or ends[-1] != len(ordered):
            ends.append(len(ordered))
        metadata['stage_prefix_modules'] = ends
        commands = [['purs', 'compile', *compiler_args, *[graph[n]['path'] for n in ordered[:end]]]
                    for end in ends]
        # Verify the complete original Spago graph with the selected target (default: JS).
        commands += [['spago', '-P', '-j', '1', 'build', '--no-install', '--purs-args', ' '.join(compiler_args)]]
    else:
        commands = [['spago', '-P', '-j', '1', 'build', '--no-install', '--purs-args', ' '.join(compiler_args)]]
    result = 0
    cancelled = []
    for signum in (signal.SIGINT, signal.SIGTERM):
        signal.signal(signum, lambda signum, frame: cancelled.append(signum))
    for index, command in enumerate(commands, 1):
        prefix = logs / f'{index:02d}'
        (prefix.with_suffix('.command.json')).write_text(json.dumps(command, indent=2))
        before, started = snapshot(), time.monotonic()
        print(f'{args.label}: step {index}/{len(commands)}, heap={args.heap}; logs={prefix}', flush=True)
        with prefix.with_suffix('.log').open('w') as log, prefix.with_suffix('.samples.jsonl').open('w') as samples:
            process = subprocess.Popen([args.time_bin, '-v', '-o', str(prefix.with_suffix('.time')),
                                        *command], cwd=app, env=env, stdout=log,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            timed_out = False
            while process.poll() is None:
                # Capture all compiler PIDs separately, never confuse cgroup cache with heap/RSS.
                stats = subprocess.run(['ps', '-C', 'purs', '-o', 'pid=,ppid=,rss=,etimes='],
                                       text=True, capture_output=True, check=False).stdout
                samples.write(json.dumps({'seconds': round(time.monotonic() - started, 2),
                                          'purs_ps': stats.strip(), 'cgroup': snapshot()}) + '\n')
                samples.flush()
                if cancelled or time.monotonic() - started >= args.timeout_seconds:
                    timed_out = not cancelled
                    stop_group(process)
                    break
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    pass
            result = 128 + cancelled[0] if cancelled else (124 if timed_out else process.returncode)
        metadata['runs'].append({'step': index, 'exit_code': result,
                                 'seconds': round(time.monotonic() - started, 2), 'timed_out': timed_out,
                                 'signal': cancelled[0] if cancelled else None,
                                 'before': before, 'after': snapshot()})
        metadata['after'] = snapshot()
        (logs / 'summary.json').write_text(json.dumps(metadata, indent=2))
        print(f'step {index}: exit={result}', flush=True)
        if result:
            break
    return result if result >= 0 else 128 - result


if __name__ == '__main__':
    sys.exit(main())
