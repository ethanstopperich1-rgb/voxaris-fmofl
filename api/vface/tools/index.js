/**
 * POST /api/vface/tools
 *
 * Tool router for Tavus CVI webhook callbacks.
 * Tavus POSTs here when the AI avatar calls a tool (e.g., updateIntakeForm).
 *
 * Session state is persisted in Google Sheets ("Live_Sessions" tab) so it
 * survives across Vercel serverless invocations.
 *
 * The tool result is sent back to Tavus via the conversations/{id}/tool_result endpoint.
 */

const { sendToolResult } = require("../../../vface/server/tavus-client");
const { logIntakeToSheet } = require("../../../vface/lib/sheets-logger");
const { putSession, getSession } = require("../../../vapi/lib/google-sheets");

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET: frontend polls for latest intake state
  if (req.method === "GET") {
    const cid = req.query?.conversation_id;
    if (!cid) return res.status(200).json({ intake: null });

    const session = await getSession(cid);
    return res.status(200).json({ intake: session });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};

  // Log EVERYTHING Tavus sends so we can see the actual payload format
  console.log("[vface/tools] RAW BODY:", JSON.stringify(body));

  // Tavus may send tool calls in different formats:
  // Format A: { tool_name, tool_call_id, conversation_id, parameters }
  // Format B: { event_type, conversation_id, properties: { ... } }
  // Format C: { conversation_id, objective_name, output_variables: { ... } }

  const conversation_id = body.conversation_id;
  const tool_call_id = body.tool_call_id;
  const tool_name = body.tool_name;
  const parameters = body.parameters;
  const event_type = body.event_type;
  const objective_name = body.objective_name;
  const output_variables = body.output_variables;

  console.log("[vface/tools] Parsed:", {
    tool_name, event_type, objective_name,
    conversation_id, tool_call_id,
    has_parameters: !!parameters,
    has_output_variables: !!output_variables,
  });

  // ── Route by tool name ──

  if (tool_name === "updateIntakeForm") {
    return handleUpdateIntakeForm({ conversation_id, tool_call_id, parameters }, res);
  }

  if (tool_name === "bookOnlineConsultation") {
    return handleBookOnlineConsultation({ conversation_id, tool_call_id, parameters }, res);
  }

  // ── Tavus lifecycle webhooks (conversation.started, conversation.ended, etc.) ──
  if (body.event_type || body.type) {
    const eventType = body.event_type || body.type;
    console.log("[vface/tools] Lifecycle event:", eventType);

    if (eventType === "conversation.ended" || eventType === "conversation_ended") {
      if (conversation_id) {
        const session = await getSession(conversation_id);
        if (session) {
          console.log("[vface/tools] Session ended, final intake data:", session);
          await logIntakeToSheet(session);
        }
      }
    }

    return res.status(200).json({ ok: true, event: eventType });
  }

  // ── Objective callbacks (Tavus sends completed objective data) ──
  if (objective_name && output_variables && conversation_id) {
    console.log("[vface/tools] Objective callback:", objective_name, output_variables);
    const existing = (await getSession(conversation_id)) || {};
    const merged = { ...existing, conversation_id, updated_at: new Date().toISOString(), ...output_variables };
    putSession(conversation_id, merged).catch(err => console.error("[vface/tools] Session persist failed:", err));
    return res.status(200).json({ status: "success" });
  }

  // ── Catch-all: log and accept anything Tavus sends ──
  console.warn("[vface/tools] Unhandled payload:", JSON.stringify(body).slice(0, 500));
  return res.status(200).json({ status: "success" });
};

// ── updateIntakeForm handler ──

async function handleUpdateIntakeForm({ conversation_id, tool_call_id, parameters }, res) {
  const {
    full_name,
    date_of_birth,
    insurance_provider,
    reason_for_visit,
    medical_history,
    symptoms,
  } = parameters || {};

  // Read existing session from Sheets, merge new data
  const existing = (await getSession(conversation_id)) || {};
  const merged = {
    ...existing,
    conversation_id,
    updated_at: new Date().toISOString(),
  };

  if (full_name) merged.full_name = full_name;
  if (date_of_birth) merged.date_of_birth = date_of_birth;
  if (insurance_provider) merged.insurance_provider = insurance_provider;
  if (reason_for_visit) merged.reason_for_visit = reason_for_visit;
  if (medical_history) merged.medical_history = medical_history;
  if (symptoms) merged.symptoms = Array.isArray(symptoms) ? symptoms : [symptoms];

  // Persist to Sheets
  putSession(conversation_id, merged).catch((err) =>
    console.error("[vface/tools] Failed to persist session:", err)
  );

  console.log("[vface/tools] Intake form updated:", merged);

  // Respond to Tavus immediately (200 OK) so the avatar doesn't hang
  res.status(200).json({
    ok: true,
    message: `Intake form updated for ${full_name || "patient"}`,
  });

  // Send tool result back to Tavus so the avatar knows the tool succeeded
  try {
    await sendToolResult(conversation_id, tool_call_id, {
      success: true,
      message: `Updated intake form. Current data: Name: ${merged.full_name || "pending"}, DOB: ${merged.date_of_birth || "pending"}, Reason: ${merged.reason_for_visit || "pending"}, Insurance: ${merged.insurance_provider || "pending"}.`,
    });
    console.log("[vface/tools] Tool result sent back to Tavus");
  } catch (err) {
    console.error("[vface/tools] Failed to send tool result:", err);
  }
}

// ── bookOnlineConsultation handler (placeholder for Phase 2) ──

async function handleBookOnlineConsultation({ conversation_id, tool_call_id, parameters }, res) {
  console.log("[vface/tools] bookOnlineConsultation called (placeholder):", parameters);

  res.status(200).json({
    ok: true,
    message: "Online consultation booking is coming soon.",
  });

  try {
    await sendToolResult(conversation_id, tool_call_id, {
      success: true,
      message:
        "I've noted your request for an online consultation. The office will follow up to schedule this. In the meantime, is there anything else I can help with for your intake?",
    });
  } catch (err) {
    console.error("[vface/tools] Failed to send tool result for booking:", err);
  }
}
