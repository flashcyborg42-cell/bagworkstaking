declare module "./vendor/resvg-wasm/index.mjs" {
  export function initWasm(input: unknown): Promise<void>;
  export class Resvg {
    constructor(svg: string | Uint8Array, options?: { fitTo?: { mode: string; value: number } });
    render(): { asPng(): Uint8Array };
  }
}

declare module "./vendor/opentype.mjs" {
  export function parse(input: ArrayBuffer | Uint8Array): {
    getPath: (text: string, x: number, y: number, fontSize: number) => { toPathData: (precision?: number) => string };
    getAdvanceWidth: (text: string, fontSize: number) => number;
  };
}
