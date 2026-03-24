declare module "qrcode" {
  export interface QRCodeToStringOptions {
    type?: "svg";
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toString(
    text: string,
    options?: QRCodeToStringOptions,
  ): Promise<string>;
}
