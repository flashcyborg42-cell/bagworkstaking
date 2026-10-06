import { renderStakeHtmlResponse } from "../../src/lib/card-html";
import { contractFromRequest } from "../../src/lib/card-shared";
import { eventToRequest, lambdaResponse, type LambdaEvent } from "../../src/lib/lambda-response";

async function render(request: Request) {
  return renderStakeHtmlResponse(request, contractFromRequest(request));
}

export default async (request: Request) => {
  try {
    return await render(request);
  } catch {
    return new Response("Stake page unavailable", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
};

export const handler = async (event: LambdaEvent) => {
  try {
    return await lambdaResponse(await render(eventToRequest(event)));
  } catch {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Stake page unavailable",
    };
  }
};

export const config = { path: "/stake/:ca" };
