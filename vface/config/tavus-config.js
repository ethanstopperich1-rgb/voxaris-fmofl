/**
 * Tavus CVI Configuration for FMOFL V·FACE
 * Family Medicine of Orlando — Dr. Daniel Hay, DO
 *
 * Centralized config: reads env vars, defines persona payload,
 * tool definitions, and conversation defaults.
 */

const fs = require("fs");
const path = require("path");

// ── Load system prompt from markdown file ──

function loadPersonaPrompt() {
  try {
    const promptPath = path.join(__dirname, "persona-prompt.md");
    return fs.readFileSync(promptPath, "utf-8").trim();
  } catch {
    console.warn("[tavus-config] Could not load persona-prompt.md — using fallback");
    return "You are Dr. Daniel Hay's friendly assistant at Family Medicine of Orlando. Help patients complete their intake.";
  }
}

// ── Config ──

const config = {
  // API
  apiKey: (process.env.TAVUS_API_KEY || "").trim(),
  apiBase: "https://tavusapi.com/v2",

  // Persona
  personaId: (process.env.TAVUS_PERSONA_ID || "").trim(),
  systemPrompt: loadPersonaPrompt(),

  // Replica
  replicaId: (process.env.TAVUS_REPLICA_ID || "").trim(),

  // Conversation defaults
  conversationDefaults: {
    conversation_name: "FMOFL V·FACE — Patient Intake",
    properties: {
      max_call_duration: 600,
      participant_left_timeout: 30,
      participant_absent_timeout: 120,
      enable_recording: false,
      enable_transcription: true,
      enable_closed_captions: true,
      language: "multilingual",
      apply_greenscreen: false,
    },
  },

  // Persona creation payload (for /api/vface/setup)
  personaPayload: {
    persona_name: "fmofl-vface-concierge",
    pipeline_mode: "full",
    layers: {
      llm: {
        model: "tavus-gpt-oss",
        speculative_inference: true,
        tools: [
          {
            type: "function",
            function: {
              name: "updateIntakeForm",
              description:
                "Update the live patient intake form on the right sidebar in real time. Call this immediately whenever you learn new patient information.",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Patient's full name" },
                  date_of_birth: { type: "string", description: "Patient's DOB (MM/DD/YYYY)" },
                  insurance_provider: { type: "string", description: "Insurance provider or self-pay" },
                  reason_for_visit: {
                    type: "string",
                    description:
                      "Routine physical, school physical, immigration exam, injection, urgent symptoms, etc.",
                  },
                  medical_history: { type: "string", description: "Any history, allergies, medications" },
                  symptoms: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of current symptoms or concerns",
                  },
                },
                required: ["full_name"],
              },
            },
          },
        ],
      },
      stt: {
        stt_engine: "tavus-advanced",
        participant_pause_sensitivity: "medium",
        participant_interrupt_sensitivity: "medium",
        smart_turn_detection: true,
      },
      tts: {
        tts_engine: "cartesia",
        tts_model_name: "sonic-3",
        external_voice_id: "f9836c6e-a0bd-460e-9d3c-f7299fa60f94",
        api_key: process.env.CARTESIA_API_KEY || "",
        tts_emotion_control: true,
        voice_settings: {
          speed: 1.05,
          stability: 0.75,
        },
      },
      conversational_flow: {
        turn_detection_model: "sparrow-1",
        turn_taking_patience: "medium",
        replica_interruptibility: "low",
      },
    },
  },

  // Objectives & Guardrails (Tavus structured format)
  objectivesAndGuardrails: {
    objectives: [
      {
        objective_name: "get_patient_info",
        objective_prompt: "Collect the patient's full name and date of birth",
        output_variables: ["full_name", "date_of_birth"],
      },
      {
        objective_name: "get_reason_for_visit",
        objective_prompt: "Understand the primary reason the patient is seeking care today",
        output_variables: ["reason_for_visit"],
        next_conditional_objectives: {
          routine_care:
            "if patient needs routine physical, school physical, medication refill, or wellness visit",
          immigration_exam: "if patient mentions immigration medical exam or green card physical",
          injection_or_procedure:
            "if patient is here for injection, testosterone, joint injection, or minor surgery consult",
          urgent_symptoms:
            "if patient describes pain, bleeding, fever, breathing issues, or other concerning symptoms",
          other: "for any other reason",
        },
      },
      {
        objective_name: "get_medical_history",
        objective_prompt:
          "Collect any relevant medical history, allergies, or current medications the patient mentions",
        output_variables: ["medical_history"],
      },
      {
        objective_name: "get_insurance",
        objective_prompt: "Collect the patient's insurance provider (or self-pay/uninsured)",
        output_variables: ["insurance_provider"],
      },
      {
        objective_name: "get_symptoms",
        objective_prompt: "If the patient mentions any symptoms or concerns, list them clearly",
        output_variables: ["symptoms"],
      },
    ],
    guardrails: [
      {
        guardrail_name: "emergency_detected",
        guardrail_prompt:
          "Patient indicates they are experiencing a life-threatening emergency (chest pain, severe bleeding, difficulty breathing, loss of consciousness)",
        modality: "verbal",
      },
      {
        guardrail_name: "no_medical_advice",
        guardrail_prompt: "Assistant is providing specific medical diagnosis or treatment recommendations",
      },
      {
        guardrail_name: "single_patient_only",
        guardrail_prompt: "More than one person is visible in the camera view",
        modality: "visual",
      },
    ],
  },
};

function isConfigured() {
  return !!(config.apiKey && config.personaId && config.replicaId);
}

function getMissingCredentials() {
  const missing = [];
  if (!config.apiKey) missing.push("TAVUS_API_KEY");
  if (!config.personaId) missing.push("TAVUS_PERSONA_ID");
  if (!config.replicaId) missing.push("TAVUS_REPLICA_ID");
  return missing;
}

module.exports = { config, isConfigured, getMissingCredentials, loadPersonaPrompt };
