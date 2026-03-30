/**
 * end-of-call-report handler — stores transcript, cost, and recording URL
 */

function handleEndOfCallReport(body) {
  const report = body.message || {};
  const callId = report.call?.id || "unknown";
  const duration = report.durationSeconds || 0;
  const cost = report.cost || 0;
  const recording = report.recordingUrl || "";
  const summary = report.summary || "";

  console.log(`[end-of-call] Call ${callId} — ${duration}s — $${cost.toFixed(4)} — recording: ${recording ? "yes" : "no"}`);

  if (summary) {
    console.log(`[end-of-call] Summary: ${summary.slice(0, 300)}`);
  }

  // Transcript
  const messages = report.messages || report.transcript || [];
  if (messages.length > 0) {
    console.log(`[end-of-call] Transcript (${messages.length} turns):`);
    for (const msg of messages.slice(0, 20)) {
      const role = msg.role || "?";
      const text = msg.message || msg.content || msg.text || "";
      if (text) console.log(`  ${role}: ${text.slice(0, 150)}`);
    }
  }

  return { ok: true };
}

module.exports = { handleEndOfCallReport };
