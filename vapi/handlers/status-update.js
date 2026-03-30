/**
 * status-update handler — logs call lifecycle events
 */

function handleStatusUpdate(body) {
  const status = body.message?.status || "unknown";
  const callId = body.message?.call?.id || "unknown";
  const ended = body.message?.endedReason || "";

  console.log(`[status-update] Call ${callId}: ${status}${ended ? ` (${ended})` : ""}`);

  return { ok: true };
}

module.exports = { handleStatusUpdate };
