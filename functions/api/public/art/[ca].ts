import { renderArtResponse } from "../../../../src/lib/card-art";

export const onRequestGet = async (context: { request: Request; params: { ca: string } }) => {
  try {
    return await renderArtResponse(context.params.ca, context.request);
  } catch {
    return new Response("Artwork unavailable", { status: 500 });
  }
};
