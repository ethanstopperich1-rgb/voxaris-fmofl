/**
 * assistant-request handler — returns single assistant config for inbound calls
 */

const { getAssistantConfig } = require("../agents/inbound/assistant");

function handleAssistantRequest(body) {
  const serverUrl = (
    process.env.VAPI_WEBHOOK_URL ||
    `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/vapi/webhook`
  ).trim();

  const call = body.message?.call || {};
  const direction = call.type || "inbound";

  console.log(`[assistant-request] ${direction} call ${call.id || "unknown"}`);

  // Single assistant — no squad needed
  return { assistant: getAssistantConfig(serverUrl) };
}

module.exports = { handleAssistantRequest };
