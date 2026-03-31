/**
 * POST /api/vface/tools
 *
 * Tool router for Tavus CVI webhook callbacks.
 * Tavus POSTs here when the AI avatar calls a tool (e.g., updateIntakeForm).
 *
 * The tool result is sent back to Tavus via the conversations/{id}/tool_result endpoint,
 * AND an app-message is broadcast to the frontend so the sidebar updates in real time.
 *
 * Tavus webhook payload shape:
 * {
 *   conversation_id: "c_...",
 *   tool_call_id: "tc_...",
 *   tool_name: "updateIntakeForm",
 *   parameters: { full_name: "...", date_of_birth: "...", ... }
 * }
 */

const { sendToolResult } = require("../../../vface/server/tavus-client");
const { logIntakeToSheet } = require("../../../vface/lib/sheets-logger");

// ── In-memory store for active sessions (keyed by conversation_id) ──
// In production, swap for Redis or a database.
const activeSessions = new Map();

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const { conversation_id, tool_call_id, tool_name, parameters } = body;

  console.log("[vface/tools] Received:", {
    tool_name,
    conversation_id,
    tool_call_id,
    parameters,
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
      // Clean up session data
      if (conversation_id) {
        const session = activeSessions.get(conversation_id);
        if (session) {
          console.log("[vface/tools] Session ended, final intake data:", session);
          // Log final state to Google Sheets
          await logIntakeToSheet(session);
          activeSessions.delete(conversation_id);
        }
      }
    }

    return res.status(200).json({ ok: true, event: eventType });
  }

  // ── Unknown tool ──
  console.warn("[vface/tools] Unknown tool:", tool_name);
  return res.status(200).json({
    ok: true,
    warning: `Unknown tool: ${tool_name}`,
  });
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

  // Store/merge intake data for this session
  const existing = activeSessions.get(conversation_id) || {};
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

  activeSessions.set(conversation_id, merged);

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

// ── SSE endpoint for frontend to poll session data ──
// The frontend polls GET /api/vface/tools?conversation_id=xxx to get latest intake state.
// (Tavus app-message is the primary real-time channel, this is the fallback.)

module.exports.getSessionData = function getSessionData(conversationId) {
  return activeSessions.get(conversationId) || null;
};
