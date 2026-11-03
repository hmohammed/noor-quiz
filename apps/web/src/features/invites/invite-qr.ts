import { create } from 'qrcode';

/**
 * QR image for a join URL, drawn in this process. Empty text throws. This module
 * does not call fetch or a QR hosting service.
 */
export function inviteQrDataUrl(text: string): string {
  if (text.length === 0) throw new Error('QR text is empty');
  const qr = create(text);
  const size = qr.modules.size;
  const cells: string[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(y, x)) {
        cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/>` +
    `<g fill="#000">${cells.join('')}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
