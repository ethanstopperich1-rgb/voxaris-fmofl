/**
 * POST /api/vapi/webhook — Main VAPI webhook handler (Vercel serverless)
 */

const { handleAssistantRequest } = require("../../vapi/handlers/assistant-request");
const { handleToolCalls } = require("../../vapi/handlers/tool-calls");
const { handleStatusUpdate } = require("../../vapi/handlers/status-update");
const { handleEndOfCallReport } = require("../../vapi/handlers/end-of-call-report");

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const messageType = body.message?.type || "unknown";
    const callId = body.message?.call?.id || "unknown";

    console.log(`[webhook] ${messageType} — call ${callId}`);

    let result;
    switch (messageType) {
      case "assistant-request":
        result = handleAssistantRequest(body);
        break;
      case "tool-calls":
        result = handleToolCalls(body);
        break;
      case "status-update":
        result = handleStatusUpdate(body);
        break;
      case "end-of-call-report":
        result = handleEndOfCallReport(body);
        break;
      case "transcript":
      case "hang":
        result = { ok: true };
        break;
      default:
        console.log(`[webhook] Unhandled: ${messageType}`);
        result = { ok: true };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[webhook] Error: ${err.message}`);
    return res.status(200).json({ ok: true, error: err.message });
  }
};
