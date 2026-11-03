/** Minimal types for the `qrcode` package. It does not ship its own declarations. */
declare module 'qrcode' {
  export interface QRCode {
    modules: {
      size: number;
      get(x: number, y: number): boolean | number;
    };
  }

  export function create(text: string): QRCode;
}
