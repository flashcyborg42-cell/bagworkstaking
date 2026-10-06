import { fallbackShareHtml, nodeApiHandler, pathContract } from "../../src/lib/node-handler";
import { renderStakeHtmlResponse } from "../../src/lib/card-html";

export default nodeApiHandler(
  (request) => renderStakeHtmlResponse(request, pathContract(request)),
  fallbackShareHtml,
);
