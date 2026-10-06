import { createFileRoute } from "@tanstack/react-router";
import { renderCardResponse } from "../../../../lib/card-png";

export const Route = createFileRoute("/api/public/og/$ca")({
  server: {
    handlers: {
      GET: async ({ request, params }) => renderCardResponse(request, params.ca),
    },
  },
});
