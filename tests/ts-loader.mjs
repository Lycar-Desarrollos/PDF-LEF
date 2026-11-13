import { registerHooks, createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const PDF_LIB_SHIM_URL = 'file:///virtual-pdf-lib-esm-shim.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === 'pdf-lib' &&
      context.parentURL &&
      !context.parentURL.includes('/node_modules/')
    ) {
      return { url: PDF_LIB_SHIM_URL, shortCircuit: true };
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !/\.[a-z0-9]+$/i.test(specifier) &&
      context.parentURL?.startsWith('file://') &&
      !context.parentURL.includes('/node_modules/')
    ) {
      const parentDir = dirname(fileURLToPath(context.parentURL));
      for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
        const candidate = resolve(parentDir, `${specifier}${ext}`);
        if (existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === PDF_LIB_SHIM_URL) {
      const pkg = require('pdf-lib/cjs/index.js');
      const keys = Object.keys(pkg).filter(
        (k) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) && k !== 'default'
      );
      const source = [
        `import { createRequire } from 'node:module';`,
        `const require = createRequire(${JSON.stringify(import.meta.url)});`,
        `const pkg = require('pdf-lib/cjs/index.js');`,
        `export default pkg;`,
        ...keys.map((k) => `export const ${k} = pkg.${k};`),
      ].join('\n');
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
