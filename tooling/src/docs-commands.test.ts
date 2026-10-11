import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// tooling/src/<this file> -> repo root is two levels up.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const scripts = Object.keys(
  (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts,
);

/** The fenced block right under the "## Commands" heading of AGENT.md. */
function agentCommandsBlock(): string {
  const md = read('AGENT.md');
  const match = /^## Commands[^\n]*\n+```[^\n]*\n([\s\S]*?)\n```/m.exec(md);
  if (!match?.[1]) throw new Error('AGENT.md has no fenced block under "## Commands"');
  return match[1];
}

/** Script names used as `npm run <name>`, skipping lines marked `# not yet`. */
function npmRunNames(text: string): string[] {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    if (line.includes('# not yet')) continue;
    for (const m of line.matchAll(/npm run ([\w:-]+)/g)) {
      if (m[1]) names.add(m[1]);
    }
  }
  return [...names];
}

describe('docs commands match root package.json scripts', () => {
  const sources = [
    ['AGENT.md Commands block', agentCommandsBlock()],
    ['README.md', read('README.md')],
  ] as const;

  it.each(sources)('every `npm run <script>` in %s exists', (_name, text) => {
    const names = npmRunNames(text);
    expect(names.length).toBeGreaterThan(0);
    const missing = names.filter((n) => !scripts.includes(n));
    expect(missing).toEqual([]);
  });

  it.each(['dev', 'test', 'test:e2e', 'lint', 'typecheck', 'build'])(
    'README mentions the developer script %s',
    (name) => {
      const readme = read('README.md');
      const used =
        name === 'test'
          ? /npm (run )?test(?![\w:-])/.test(readme)
          : new RegExp(`npm run ${name}(?![\\w:-])`).test(readme);
      expect(used).toBe(true);
      expect(scripts).toContain(name);
    },
  );
});
