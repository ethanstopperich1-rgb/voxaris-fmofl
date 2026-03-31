/**
 * POST /api/vface/setup
 *
 * One-time endpoint to create the Tavus persona for FMOFL V·FACE.
 * Run this once, then save the returned persona_id to TAVUS_PERSONA_ID env var.
 *
 * Requires: TAVUS_API_KEY, TAVUS_REPLICA_ID
 * Returns: { persona_id, persona_name }
 */

const { config } = require("../../../vface/config/tavus-config");
const { createPersona, listReplicas } = require("../../../vface/server/tavus-client");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. POST to create persona." });
  }

  if (!config.apiKey) {
    return res.status(503).json({ error: "TAVUS_API_KEY not set" });
  }

  // ── Optional: list replicas to help user pick one ──
  const { action } = req.body || {};

  if (action === "list_replicas") {
    try {
      const replicas = await listReplicas();
      console.log("[vface/setup] Replicas listed:", replicas?.length || 0);
      return res.status(200).json({ replicas });
    } catch (err) {
      console.error("[vface/setup] Failed to list replicas:", err);
      return res.status(500).json({ error: "Failed to list replicas", details: err.body || err.message });
    }
  }

  // ── Create persona ──
  try {
    const personaPayload = {
      ...config.personaPayload,
      system_prompt: config.systemPrompt,
    };

    // Attach replica if configured
    if (config.replicaId) {
      personaPayload.default_replica_id = config.replicaId;
    }

    console.log("[vface/setup] Creating persona:", {
      name: personaPayload.persona_name,
      model: personaPayload.layers?.llm?.model,
      tts: personaPayload.layers?.tts?.tts_engine,
      tools: personaPayload.layers?.llm?.tools?.length || 0,
      has_replica: !!config.replicaId,
    });

    const result = await createPersona(personaPayload);

    console.log("[vface/setup] Persona created:", result);

    return res.status(200).json({
      success: true,
      persona_id: result.persona_id,
      persona_name: result.persona_name || personaPayload.persona_name,
      message: "Persona created! Save the persona_id as TAVUS_PERSONA_ID env var.",
      next_steps: [
        `Set TAVUS_PERSONA_ID=${result.persona_id} in your Vercel env vars`,
        "Deploy with: npx vercel --prod --yes",
        "Test at: https://your-domain.vercel.app/vface.html",
      ],
    });
  } catch (err) {
    console.error("[vface/setup] Persona creation failed:", err);
    return res.status(500).json({
      error: "persona_creation_failed",
      details: err.body || err.message || "Unknown error",
    });
  }
};
