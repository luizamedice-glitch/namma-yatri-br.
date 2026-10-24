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


def dependency_batches(graph, ordered, size):
    """Bound new targets; include only their transitive imports, never prior unrelated targets."""
    batches, targets = [], []
    heavy = {'Screens.HomeScreen.Controller', 'Screens.HomeScreen.View', 'Flow', 'Main', 'Development.Passenger', 'Development.Driver'}
    def flush():
        if not targets:
            return
        closure = set()
        def visit(name):
            if name in closure or name not in graph:
                return
            closure.add(name)
            for dep in graph[name]['depends']:
                visit(dep)
        for name in targets:
            visit(name)
        batches.append({'targets': list(targets), 'sources': [n for n in ordered if n in closure]})
        targets.clear()
    for name in ordered:
        if name in heavy:
            flush()
            targets.append(name)
            flush()
        else:
            targets.append(name)
            if len(targets) >= size:
                flush()
    flush()
    return batches


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', choices=['passageiro', 'motorista'], default='passageiro')
    parser.add_argument('--compiler-version', choices=['0.15.4', '0.15.14'], default='0.15.4')
    parser.add_argument('--heap', default='2500m', help='GHC heap cap, not a Node/V8 setting')
    parser.add_argument('--label', default='build')
    parser.add_argument('--mode', choices=['full', 'module', 'staged'], default='full')
    parser.add_argument('--codegen', choices=['js', 'corefn'], default='js')
    parser.add_argument('--module', default='Resources.LocalizableV2.Strings')
    parser.add_argument('--target-module', help='Limit staged compilation to one module dependency closure')
    parser.add_argument('--batch-size', type=int, default=1)
    parser.add_argument('--warmup-module', action='append', default=[], help='Additional module closure to compile first')
    parser.add_argument('--no-default-warmup', action='store_true', help='Reproduce plain topological batches')
    parser.add_argument('--logs', type=Path, default=ROOT / 'purescript-diagnostics')
    parser.add_argument('--time-bin', default='/usr/bin/time')
    parser.add_argument('--timeout-seconds', type=int, default=1800, help='Time limit per compiler invocation')
    parser.add_argument('--stall-seconds', type=int, default=300, help='Stop when compiler output stops advancing')
    parser.add_argument('--rss-limit-mib', type=int, default=0, help='Stop at total sampled compiler RSS; zero derives from memory budget')
    parser.add_argument('--require-cache', action='store_true', help='Fail if this verification starts compiling any module')
    args = parser.parse_args()
    if not re.fullmatch(r'[1-9][0-9]*[mMgG]', args.heap):
        parser.error('--heap must be a positive integer followed by m or g')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', args.label) or min(args.batch_size, args.timeout_seconds, args.stall_seconds) < 1 or args.rss_limit_mib < 0:
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
        for name in warmups:
            if name not in graph:
                parser.error(f'warmup module absent from graph: {name}')
            visit(name)
        metadata['warmup_modules'] = warmups
        if args.target_module and args.target_module not in graph:
            parser.error('target module absent from graph')
        for name in ([args.target_module] if args.target_module else sorted(graph)):
            visit(name)
        batches = dependency_batches(graph, ordered, args.batch_size)
        metadata['batches'] = batches
        commands = [['purs', 'compile', *compiler_args, *[graph[n]['path'] for n in batch['sources']]]
                    for batch in batches]
        # The caller performs a guarded cache verification separately; never append a blind full build.

    else:
        commands = [['spago', '-P', '-j', '1', 'build', '--no-install', '--purs-args', ' '.join(compiler_args)]]
    rss_limit = args.rss_limit_mib * 1024 if args.rss_limit_mib else ((limit - reserve) // 1024 if limit else 0)
    metadata['rss_limit_kib'] = rss_limit
    (logs / 'plan.json').write_text(json.dumps(metadata, indent=2))
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
            stop_reason = None
            last_size, last_progress, last_report = 0, started, started
            peak_rss = 0
            while process.poll() is None:
                # Capture all compiler PIDs separately, never confuse cgroup cache with heap/RSS.
                stats = subprocess.run(['ps', '-C', 'purs', '-o', 'pid=,ppid=,rss=,etimes='],
                                       text=True, capture_output=True, check=False).stdout
                samples.write(json.dumps({'seconds': round(time.monotonic() - started, 2),
                                          'purs_ps': stats.strip(), 'cgroup': snapshot()}) + '\n')
                samples.flush()
                now = time.monotonic()
                output_size = prefix.with_suffix('.log').stat().st_size
                if output_size != last_size:
                    last_size, last_progress = output_size, now
                rss = sum(int(row.split()[2]) for row in stats.splitlines() if row.strip())
                peak_rss = max(peak_rss, rss)
                if now - last_report >= 30:
                    print(f'step {index}: elapsed={now-started:.0f}s RSS={rss/1024:.0f}MiB idle={now-last_progress:.0f}s', flush=True)
                    last_report = now
                if args.require_cache and output_size and 'Compiling ' in prefix.with_suffix('.log').read_text(errors='replace'):
                    stop_reason = 'unexpected_recompile'
                elif rss_limit and rss >= rss_limit:
                    stop_reason = 'rss_limit'
                elif now - last_progress >= args.stall_seconds:
                    stop_reason = 'no_compiler_output'
                if cancelled or stop_reason or now - started >= args.timeout_seconds:
                    timed_out = not cancelled and not stop_reason
                    stop_reason = stop_reason or ('cancelled' if cancelled else 'timeout')
                    stop_group(process)
                    break
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    pass
            result = 128 + cancelled[0] if cancelled else (125 if stop_reason and not timed_out else (124 if timed_out else process.returncode))
        metadata['runs'].append({'step': index, 'exit_code': result,
                                 'seconds': round(time.monotonic() - started, 2), 'timed_out': timed_out,
                                 'stop_reason': stop_reason, 'peak_sampled_rss_kib': peak_rss,
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
