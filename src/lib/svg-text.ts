import { parse, type ParsedFont } from "./vendor/opentype.mjs";
import { toArrayBuffer } from "./host-files";

export type CardFonts = { regular: ParsedFont; bold: ParsedFont };

export function parseCardFonts(regular: ArrayBuffer | Uint8Array, bold: ArrayBuffer | Uint8Array): CardFonts {
  return { regular: parse(toArrayBuffer(regular)), bold: parse(toArrayBuffer(bold)) };
}

function pathData(d: string) {
  return d
    .replace(/[0-9.]+e[-+]?[0-9]+/gi, (token) => Number(token).toFixed(4))
    .replace(/([0-9.])([MLHVCSQTAZmlhvcsqtaz])/g, "$1 $2");
}

function glyphPath(font: ParsedFont, character: string, x: number, y: number, size: number, fill: string) {
  if (character === " ") return "";
  try {
    const data = pathData(font.getPath(character, x, y, Math.max(size, 40)).toPathData(5));
    if (!data) return "";
    if (size >= 40) return `<path d="${data}" fill="${fill}"/>`;
    const k = size / 40;
    return `<g transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})"><path d="${data}" fill="${fill}"/></g>`;
  } catch {
    return "";
  }
}

export function svgText(
  fonts: CardFonts,
  content: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  options: { weight?: 400 | 700; anchor?: "start" | "middle" | "end"; spacing?: number } = {},
) {
  const font = options.weight === 400 ? fonts.regular : fonts.bold;
  const spacing = options.spacing ?? 0;
  let width = 0;
  for (const character of content) width += font.getAdvanceWidth(character, size) + spacing;
  if (content.length) width -= spacing;
  let cursor = x;
  if (options.anchor === "middle") cursor -= width / 2;
  if (options.anchor === "end") cursor -= width;
  const nodes: string[] = [];
  for (const character of content) {
    const node = glyphPath(font, character, cursor, y, size, fill);
    if (node) nodes.push(node);
    cursor += font.getAdvanceWidth(character, size) + spacing;
  }
  return nodes.join("");
}

export type TextWriter = (
  content: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  options?: { weight?: 400 | 700; anchor?: "start" | "middle" | "end"; spacing?: number },
) => string;

export function makeTextWriter(fonts: CardFonts): TextWriter {
  return (content, x, y, size, fill, options) => svgText(fonts, content, x, y, size, fill, options);
}
