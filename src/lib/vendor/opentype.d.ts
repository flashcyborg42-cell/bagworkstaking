export function parse(input: ArrayBuffer | Uint8Array): ParsedFont;

export type ParsedFont = {
  getPath: (text: string, x: number, y: number, fontSize: number) => { toPathData: (precision?: number) => string };
  getAdvanceWidth: (text: string, fontSize: number) => number;
};
