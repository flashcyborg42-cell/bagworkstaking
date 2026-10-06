import wasm from "../../../../wasm/resvg.wasm";
import { renderCardResponse, seedWasm } from "../../../../src/lib/card-png";

export const onRequestGet = async (context: { request: Request; params: { ca: string } }) => {
  try {
    try {
      await seedWasm(wasm);
    } catch (error) {
      console.warn("seedWasm failed", error);
    }
    return await renderCardResponse(context.request, context.params.ca);
  } catch {
    return new Response("Preview card unavailable", { status: 500 });
  }
};
