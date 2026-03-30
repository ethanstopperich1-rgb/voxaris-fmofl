/**
 * FMOFL — Single Inbound Assistant Config
 * Family Medicine of Orlando — Dr. Daniel Hay
 *
 * Returns a VAPI assistant config (not a squad).
 * Used by assistant-request handler for inbound calls.
 */

const fs = require("fs");
const path = require("path");
const { INBOUND_TOOLS } = require("../../lib/tools");

function loadPrompt(filename) {
  return fs.readFileSync(
    path.join(__dirname, "prompts", filename),
    "utf-8"
  );
}

// Rime Arcana — multilingual (English, Spanish, Portuguese + more)
const VOICE_CONFIG = {
  provider: "rime-ai",
  voiceId: "moraine",
  model: "arcana",
};

// Deepgram Nova-2 with multi-language detection
const TRANSCRIBER_CONFIG = {
  provider: "deepgram",
  model: "nova-2",
  language: "multi",  // Auto-detects English, Spanish, Portuguese
};

function getAssistantConfig(serverUrl) {
  return {
    name: "FMOFL Receptionist",
    firstMessage:
      "Hi, thanks for calling Family Medicine of Orlando, Dr. Hay's office. How can I help you today?",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: loadPrompt("receptionist.txt") }],
      temperature: 0.4,
      maxTokens: 200,
      tools: INBOUND_TOOLS,
    },
    voice: VOICE_CONFIG,
    transcriber: TRANSCRIBER_CONFIG,
    serverUrl,
    serverMessages: ["tool-calls", "status-update", "end-of-call-report"],
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 30,
    backgroundSound: "office",
    endCallMessage: "Thanks for calling Family Medicine of Orlando. Have a great day!",
  };
}

module.exports = { getAssistantConfig };
