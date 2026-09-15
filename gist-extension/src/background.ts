// Service worker: the only piece that talks to the backend. Content scripts
// run in the page's own origin and would be blocked by CORS calling
// localhost directly; a request from here is covered by this extension's
// own host_permissions instead, so no CORS setup is needed on the backend.

const BACKEND_URL = "https://designtask1.onrender.com";

interface ExplainRequest {
  type: "explain";
  passage: string;
  context?: string | null;
}

type ExplainResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; status?: number };

async function callExplain(passage: string, context: string | null | undefined): Promise<ExplainResult> {
  let resp: Response;
  try {
    resp = await fetch(`${BACKEND_URL}/api/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passage, context: context ?? null }),
    });
  } catch (e) {
    return {
      ok: false,
      error: "Could not reach the gist-backend at " + BACKEND_URL,
    };
  }

  let body: unknown;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }

  if (!resp.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${resp.status}`;
    return { ok: false, error: detail, status: resp.status };
  }

  return { ok: true, data: body };
}

chrome.runtime.onMessage.addListener((message: ExplainRequest, _sender, sendResponse) => {
  if (message?.type !== "explain") return undefined;
  callExplain(message.passage, message.context).then(sendResponse);
  return true; // keep the message channel open for the async response
});
