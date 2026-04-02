/**
 * end-of-call-report handler — stores transcript, cost, recording,
 * structured data, summary, and success evaluation to Google Sheets
 */

const { logCallSummary, logStructuredData } = require("../lib/google-sheets");

function handleEndOfCallReport(body) {
  const report = body.message || {};
  const callId = report.call?.id || "unknown";
  const duration = report.durationSeconds || 0;
  const cost = report.cost || 0;
  const recording = report.recordingUrl || report.artifact?.recordingUrl || "";
  const summary = report.summary || report.analysis?.summary || "";
  const structuredData = report.analysis?.structuredData || report.structuredData || null;
  const successEvaluation = report.analysis?.successEvaluation || report.successEvaluation || null;

  console.log(`[end-of-call] Call ${callId} — ${duration}s — $${cost.toFixed(4)} — recording: ${recording ? "yes" : "no"}`);

  if (summary) {
    console.log(`[end-of-call] Summary: ${summary.slice(0, 300)}`);
  }

  if (structuredData) {
    console.log(`[end-of-call] Structured data:`, JSON.stringify(structuredData));
  }

  if (successEvaluation !== null) {
    console.log(`[end-of-call] Success: ${successEvaluation}`);
  }

  // Transcript
  const messages = report.messages || report.transcript || report.artifact?.messages || [];
  if (messages.length > 0) {
    console.log(`[end-of-call] Transcript (${messages.length} turns):`);
    for (const msg of messages.slice(0, 20)) {
      const role = msg.role || "?";
      const text = msg.message || msg.content || msg.text || "";
      if (text) console.log(`  ${role}: ${text.slice(0, 150)}`);
    }
  }

  // Log call summary to Sheets "Calls" tab
  logCallSummary(report).catch((err) =>
    console.error("[end-of-call] Failed to log call summary:", err)
  );

  // Log structured data to Sheets "Call Analysis" tab
  if (structuredData) {
    logStructuredData({
      callId,
      duration,
      cost,
      summary,
      successEvaluation,
      ...structuredData,
    }).catch((err) =>
      console.error("[end-of-call] Failed to log structured data:", err)
    );
  }

  return { ok: true };
}

module.exports = { handleEndOfCallReport };
