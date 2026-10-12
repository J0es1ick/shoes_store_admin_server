const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sourceRoot = path.resolve('src');
const allowed = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain'],
  presentation: ['presentation', 'application', 'domain'],
  app: ['app', 'presentation', 'infrastructure', 'application', 'domain'],
};
const errors = [];
function visitDirectory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      visitDirectory(file);
      continue;
    }
    if (
      !/\.tsx?$/.test(file) ||
      /\.(test|spec)\.tsx?$/.test(file) ||
      file.endsWith('.d.ts')
    )
      continue;
    const relative = path.relative(sourceRoot, file).replaceAll('\\', '/');
    const layer = relative.split('/')[0];
    if (!allowed[layer]) continue; // Root entry point wires the application.
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function inspect(node) {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                node.expression.getText(source) === 'require')
            ? node.arguments[0]
            : null;
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text;
        if (name.startsWith('.')) {
          const target = path
            .relative(sourceRoot, path.resolve(path.dirname(file), name))
            .replaceAll('\\', '/')
            .split('/')[0];
          if (!allowed[layer].includes(target))
            errors.push(`${relative}: ${layer} cannot import ${name}`);
        } else if (['domain', 'application'].includes(layer))
          errors.push(`${relative}: core cannot depend on ${name}`);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    if (
      ['domain', 'application'].includes(layer) &&
      /\b(window|document|localStorage|fetch|process)\b/.test(
        source.text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''),
      )
    )
      errors.push(`${relative}: runtime access belongs in an adapter`);
  }
}
visitDirectory(sourceRoot);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Architecture boundaries verified.');
