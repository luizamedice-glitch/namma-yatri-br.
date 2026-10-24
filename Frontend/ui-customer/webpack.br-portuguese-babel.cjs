// SPDX-License-Identifier: AGPL-3.0-or-later
// Only literal display properties are localized; identifiers and request data stay intact.
const path = require('path');
module.exports = ({types: t}) => ({visitor: {
FunctionDeclaration(p, state) {
  const filename = state.file.opts.filename || '';
  if (!filename.endsWith(path.join('Engineering.Helpers.Commons', 'foreign.js'))
      || !p.node.id || p.node.id.name !== 'getFormattedLanguage') return;
  const runtime = path.resolve(__dirname, 'src/Localization/Runtime.js');
  p.node.body.body.unshift(t.ifStatement(t.logicalExpression('&&',
    t.binaryExpression('===', t.identifier('language'), t.stringLiteral('PT_BR')),
    t.callExpression(t.memberExpression(t.callExpression(t.identifier('require'), [t.stringLiteral(runtime)]),
      t.identifier('isPortugueseEnabled')), [])), t.returnStatement(t.stringLiteral('pt-BR'))));
},
CallExpression(p, state) {
  const filename = state.file.opts.filename;
  if (!filename || !filename.includes(path.sep + 'output' + path.sep)) return;
  const c = p.node.callee;
  if (!t.isMemberExpression(c) || !t.isIdentifier(c.object) || !t.isIdentifier(c.property)) return;
  const display = /^PrestoDOM/.test(c.object.name) && ['text', 'hint', 'accessibilityHint', 'textFromHtml'].includes(c.property.name);
  const toast = /^JBridge/.test(c.object.name) && ['toast', 'toastWithLog'].includes(c.property.name);
  if (!display && !toast) return;
  const a = p.node.arguments[0];
  const dictionary = require('./src/Localization/pt-BR.json').literals;
  if (!t.isStringLiteral(a) || !Object.prototype.hasOwnProperty.call(dictionary, a.value)) return;
  const runtime = path.resolve(__dirname, 'src/Localization/Runtime.js');
  p.node.arguments[0] = t.callExpression(t.memberExpression(
    t.callExpression(t.identifier('require'), [t.stringLiteral(runtime)]), t.identifier('localizeLiteral')), [a]);
}}});
