"""Validate coverage and interpolation against the unchanged English source catalog."""
from pathlib import Path
import collections, hashlib, json, re
root = Path(__file__).resolve().parents[2]
p = root/'Frontend/ui-customer/src/Resources/LocalizableV2/EN.purs'
s = p.read_text().split('getEn = Keymap {',1)[1].rsplit('}',1)[0]
a = re.split(r"(?m)^\s*,?\s*([a-zA-Z_][\w']*)\s*:\s*",s)
source = {}
for i in range(1,len(a),2):
    key, expr = a[i], a[i+1].strip()
    m = re.search(r'\\\s*([\w\s]+?)\s*->',expr)
    args = m.group(1).split() if m else []
    if m: expr=expr[m.end():].strip().rstrip(')')
    text=''
    for token in re.findall(r'"(?:\\.|[^"\\])*"|\b\w+\b|[^\w\s]',expr):
        if token.startswith('"'): text+=json.loads(token)
        elif token in args: text+='{'+str(args.index(token))+'}'
        else: assert token in ['<','>','(',')'], (key,token)
    source[key]={'arity':len(args),'text':text}
d=json.loads((root/'Frontend/ui-customer/src/Localization/pt-BR.json').read_text())
assert d['sourceSha256']==hashlib.sha256(p.read_bytes()).hexdigest()
assert source.keys()==d['messages'].keys()
for k, original in source.items():
    target=d['messages'][k]
    assert target['arity']==original['arity'],k
    for pattern in [r'\{\d*\}',r'</?[^>]+>',r'[₹€£$]',r'https?://[^\s<>]+']:
        assert collections.Counter(re.findall(pattern,original['text']))==collections.Counter(re.findall(pattern,target['text'])),(k,pattern)
    assert target['text'].strip() or not original['text'].strip(),k
    assert '⁇' not in target['text'],k
print('PASS:',len(source),'catalog messages; source hash, interpolation, markup and currency preserved')
