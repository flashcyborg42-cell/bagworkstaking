export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export type ResvgRenderOptions = {
  dpi?: number;
  languages?: string[];
  fitTo?: {
    mode: "original";
  } | {
    mode: "width";
    value: number;
  } | {
    mode: "height";
    value: number;
  } | {
    mode: "zoom";
    value: number;
  };
  background?: string;
};
export declare const initWasm: (module_or_path: Promise<InitInput> | InitInput) => Promise<void>;
export declare const Resvg: {
  new (svg: Uint8Array | string, options?: ResvgRenderOptions | undefined): {
    free(): void;
    render(): { asPng(): Uint8Array };
  };
};
