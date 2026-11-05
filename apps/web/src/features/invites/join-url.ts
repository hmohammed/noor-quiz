/** Absolute join URL for an invite token. The API does not build this. */
export function joinUrl(token: string, origin: string): string {
  return new URL(`/join/${token}`, origin).href;
}
