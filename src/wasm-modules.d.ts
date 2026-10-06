declare module "*.wasm" {
  const value: WebAssembly.Module | ArrayBuffer;
  export default value;
}
