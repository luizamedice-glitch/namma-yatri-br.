"""Allow only the reviewed Android locale hooks when reusing compiled PureScript."""
import subprocess, sys
from pathlib import Path
p = 'Frontend/ui-customer/webpack.android.js'
source = subprocess.check_output(['git', 'show', sys.argv[1] + ':' + p], text=True)
current = Path(p).read_text()
for line in ["const brPortuguesePlugin = require('./webpack.br-portuguese.cjs');\n", '    brPortuguesePlugin(),\n', "  const base = common(env);\n", "  base.module.rules[0].use.options.plugins = [require.resolve('./webpack.br-portuguese-babel.cjs')];\n"]:
    current = current.replace(line, '')
current = current.replace('return merge(base, {', 'return merge(common(env), {')
assert current.rstrip() == source.rstrip(), 'Android Webpack changed outside the reviewed locale hooks'
print('PureScript cache: Android entry/output/config preserved; only locale hooks added')
