/**
 * POST /api/vface/conversations
 *
 * Creates a new Tavus CVI session for FMOFL patient intake.
 * Returns { conversation_id, conversation_url, status } for the frontend to join.
 *
 * Body (all optional):
 *   visitor_name  — pre-fill greeting with patient name
 *   concern       — reason for visit hint
 *   urgency       — "routine" | "urgent" | "emergency"
 *   language      — "english" | "spanish" | "portuguese"
 */

const { isConfigured, getMissingCredentials } = require("../../../vface/config/tavus-config");
const { createConversation } = require("../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Check configuration ──
  if (!isConfigured()) {
    console.error("[vface/conversations] Missing credentials:", getMissingCredentials());
    return res.status(503).json({
      error: "tavus_not_configured",
      missing: getMissingCredentials(),
    });
  }

  try {
    const { visitor_name, concern, urgency, language } = req.body || {};

    // ── Build contextual greeting ──
    let greeting;
    if (visitor_name) {
      greeting = `Hi ${visitor_name}, welcome to Family Medicine of Orlando! I'm here to help you get started before your visit with Dr. Hay. Let's begin — what's your full name as it appears on your ID?`;
    } else {
      greeting = "Hi there, welcome to Family Medicine of Orlando! I'm Dr. Hay's assistant, and I'm here to help you complete your intake. Let's start with your full name.";
    }

    // ── Build conversation context ──
    let context = "";
    if (concern) context += `The patient has indicated their reason for visit is: ${concern}. `;
    if (urgency === "emergency") {
      context += "The patient has flagged this as urgent — ask about symptoms immediately. ";
    }
    if (language && language !== "english") {
      context += `The patient prefers to speak in ${language}. Switch to that language immediately. `;
    }

    // Use production domain for callback URL — VERCEL_URL changes per deployment
    // but the callback must be stable so Tavus can reach it after redeployments
    const baseUrl = (
      process.env.VFACE_BASE_URL
      || "https://fmofl-command.vercel.app"
    ).trim();

    const callbackUrl = `${baseUrl}/api/vface/tools`;

    console.log("[vface/conversations] Creating session:", {
      visitor_name: visitor_name || "(anonymous)",
      concern: concern || "(none)",
      callbackUrl,
    });

    const result = await createConversation({
      greeting,
      context: context || undefined,
      callbackUrl,
      language: language || undefined,
    });

    console.log("[vface/conversations] Session created:", {
      conversation_id: result.conversation_id,
      status: result.status,
    });

    return res.status(200).json({
      conversation_id: result.conversation_id,
      conversation_url: result.conversation_url,
      status: result.status || "active",
    });
  } catch (err) {
    console.error("[vface/conversations] Error:", err);
    return res.status(500).json({
      error: "conversation_creation_failed",
      details: err.body || err.message || "Unknown error",
    });
  }
};
