import { describe, expect, it, vi } from 'vitest';
import { inviteQrDataUrl } from './invite-qr';

describe('inviteQrDataUrl', () => {
  it('returns a data URL and does not call fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'));
    const url = inviteQrDataUrl('https://noor.example/join/01ARZ3NDEKTSV4RRFFQ69G5FAV');
    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(url).not.toMatch(/https?:\/\//);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('throws when the text is empty', () => {
    expect(() => inviteQrDataUrl('')).toThrow(/empty/);
  });

  it('differs for different text', () => {
    expect(inviteQrDataUrl('https://noor.example/join/a')).not.toBe(
      inviteQrDataUrl('https://noor.example/join/b'),
    );
  });
});
