import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// Static `import … from 'x'`, side-effect `import 'x'`, `export … from 'x'` and dynamic `import('x')`.
const specifierPattern =
  /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

function importsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  return [...code.matchAll(specifierPattern)].map((m) => m[1] ?? '');
}

const isFirebase = (specifier: string) =>
  specifier === 'firebase' || specifier.startsWith('firebase/') || specifier.startsWith('@firebase/');

describe('Firebase boundary in apps/web/src', () => {
  const files = sourceFiles(srcDir).map((path) => ({
    name: relative(srcDir, path).split(sep).join('/'),
    imports: importsOf(path),
  }));

  it('scans the source tree', () => {
    expect(files.map((f) => f.name)).toContain('auth/session.ts');
    expect(files.map((f) => f.name)).toContain('api/client.ts');
  });

  it('only auth/session.ts imports Firebase', () => {
    const importers = files.filter((f) => f.imports.some(isFirebase)).map((f) => f.name);
    expect(importers).toEqual(['auth/session.ts']);
  });

  it('auth/session.ts imports only firebase/app and firebase/auth', () => {
    const session = files.find((f) => f.name === 'auth/session.ts');
    const firebaseImports = new Set(session?.imports.filter(isFirebase));
    expect([...firebaseImports].sort()).toEqual(['firebase/app', 'firebase/auth']);
  });
});
