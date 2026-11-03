import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en.json';
import { InviteDialog, type InviteDialogState } from './InviteDialog';
import { joinUrl } from './join-url';

const TOKEN = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const JOIN = joinUrl(TOKEN, 'https://noor.example');
const noop = () => undefined;

const ready = (copy: 'idle' | 'copied' | 'failed'): InviteDialogState => ({
  kind: 'ready',
  url: JOIN,
  expiresAt: '2026-03-08T12:00:00.000Z',
  timeZone: 'Europe/Stockholm',
  copy,
});

const render = (state: InviteDialogState) =>
  renderToStaticMarkup(<InviteDialog state={state} onClose={noop} onRetry={noop} onCopy={noop} />);

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');

describe('InviteDialog', () => {
  it('shows a /join/{token} link and a data-URL QR without calling fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'));
    const html = render(ready('idle'));
    const href = /href="([^"]+)"/.exec(html)?.[1];
    expect(href).toBeDefined();
    expect(new URL(href ?? '').pathname).toBe(`/join/${TOKEN}`);
    expect(html).toMatch(/<img[^>]*src="data:/);
    expect(html).not.toMatch(/src="https?:/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps the link visible when copy failed', () => {
    const html = render(ready('failed'));
    expect(html).toContain(JOIN);
    expect(html).toContain(en['community.invite.copyFailed']);
    expect(new URL(/href="([^"]+)"/.exec(html)?.[1] ?? '').pathname).toBe(`/join/${TOKEN}`);
  });

  it('uses an en.json value for every invite string', () => {
    const html = [
      render({ kind: 'loading' }),
      render({ kind: 'error' }),
      render(ready('idle')),
      render(ready('copied')),
      render(ready('failed')),
    ].join('\n');
    for (const [key, value] of Object.entries(en)) {
      if (!key.startsWith('community.invite')) continue;
      expect(html, key).toContain(escape(value));
    }
  });
});
