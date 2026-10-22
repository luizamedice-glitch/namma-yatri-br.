#!/usr/bin/env python3
"""Compile and exercise the production PureScript validator, with no Android/API mocks."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
app = root / 'ui-customer'
source = root / 'ui-common/src/Engineering/Helpers/BrazilianMobileNumber.purs'
modules = {}
for path in (app / '.spago').glob('*/**/src/**/*.purs'):
    text = path.read_text()
    match = re.search(r'^module\s+([\w.]+)', text, re.M)
    if match:
        modules[match[1]] = (path, text)
modules['Engineering.Helpers.BrazilianMobileNumber'] = (source, source.read_text())
selected = {}
def visit(name):
    if name in selected or name == 'Prim' or name.startswith('Prim.'):
        return
    path, text = modules[name]
    selected[name] = path
    for dependency in re.findall(r'^import\s+([\w.]+)', text, re.M):
        visit(dependency)
visit('Engineering.Helpers.BrazilianMobileNumber')
with tempfile.TemporaryDirectory(prefix='yatri-phone-') as directory:
    output = Path(directory) / 'output'
    subprocess.run([os.environ.get('PURS', 'purs'), 'compile', *map(str, selected.values()), '-o', str(output)], check=True)
    module = (output / 'Engineering.Helpers.BrazilianMobileNumber/index.js').as_uri()
    # Non-routable test inputs stay in process: no phone number is submitted to any service.
    js = '''
import assert from 'node:assert/strict';
import {isValid, isValidPrefix} from MODULE;
const valid = ['11987654321','21912345678','61999999999','92900000000'];
for (const number of valid) {
  assert.equal(isValid(number), true, number);
  for (let size=0;size<=11;size++) assert.equal(isValidPrefix(number.slice(0,size)), true, number.slice(0,size));
}
const invalid = ['', '1', '1198765432', '119876543210', '01987654321', '23987654321',
 '52987654321', '72987654321', '11887654321', '11987a54321', '+5511987654321',
 '11 987654321', '１１９８７６５４３２１', '11987654321\\n'];
for (const number of invalid) assert.equal(isValid(number), false, JSON.stringify(number));
for (const number of ['0','23','52','72','118','a','11 ','119876543210']) assert.equal(isValidPrefix(number), false, number);
console.log('PASS: 4 validos, 48 prefixos, 14 invalidos e 8 prefixos invalidos; validador PureScript compilado.');
'''.replace('MODULE', json.dumps(module))
    subprocess.run(['node', '--input-type=module', '-e', js], check=True)
