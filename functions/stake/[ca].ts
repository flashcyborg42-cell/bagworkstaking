import { renderStakeHtmlResponse } from "../../src/lib/card-html";

export const onRequestGet = async (context: { request: Request; params: { ca: string } }) => {
  try {
    return await renderStakeHtmlResponse(context.request, context.params.ca);
  } catch {
    return new Response("Stake page unavailable", { status: 500 });
  }
};
