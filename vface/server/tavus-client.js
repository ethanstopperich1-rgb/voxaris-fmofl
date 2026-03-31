/**
 * Tavus API Client for FMOFL V·FACE
 * Zero-dependency — uses Node https module only.
 *
 * Auth: x-api-key header (NOT Authorization Bearer like VAPI)
 * Patch: JSON Patch RFC 6902 (array of ops, NOT regular JSON body)
 */

const https = require("https");
const { config } = require("../config/tavus-config");

// ── Core request helper ──

function tavusRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(`${config.apiBase}${path}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
    };

    if (payload) {
      options.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = { raw: data };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject({ status: res.statusCode, body: parsed });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Conversations ──

async function createConversation({ greeting, context, conversationName, callbackUrl }) {
  const payload = {
    persona_id: config.personaId,
    replica_id: config.replicaId,
    conversation_name: conversationName || config.conversationDefaults.conversation_name,
    properties: { ...config.conversationDefaults.properties },
  };

  if (greeting) payload.custom_greeting = greeting;
  if (context) payload.conversational_context = context;
  if (callbackUrl) payload.callback_url = callbackUrl;

  console.log("[tavus-client] Creating conversation:", {
    persona_id: payload.persona_id,
    replica_id: payload.replica_id,
    has_callback: !!callbackUrl,
    callback_url: callbackUrl || "(none — tool calls disabled)",
  });

  return tavusRequest("POST", "/conversations", payload);
}

async function endConversation(conversationId) {
  return tavusRequest("POST", `/conversations/${conversationId}/end`);
}

async function getConversation(conversationId) {
  return tavusRequest("GET", `/conversations/${conversationId}`);
}

// ── Tool Results ──

async function sendToolResult(conversationId, toolCallId, result) {
  console.log("[tavus-client] Sending tool result:", { conversationId, toolCallId });
  return tavusRequest("POST", `/conversations/${conversationId}/tool_result`, {
    tool_call_id: toolCallId,
    result,
  });
}

// ── Personas ──

async function createPersona(personaData) {
  return tavusRequest("POST", "/personas", personaData);
}

async function getPersona(personaId) {
  return tavusRequest("GET", `/personas/${personaId}`);
}

/**
 * Update persona using JSON Patch (RFC 6902)
 * @param {string} personaId
 * @param {Array<{op: string, path: string, value: any}>} patchOps
 */
async function updatePersona(personaId, patchOps) {
  return tavusRequest("PATCH", `/personas/${personaId}`, patchOps);
}

async function listPersonas() {
  return tavusRequest("GET", "/personas");
}

// ── Replicas ──

async function listReplicas() {
  return tavusRequest("GET", "/replicas");
}

// ── Documents (Knowledge Base) ──

async function createDocument({ name, url, tags }) {
  return tavusRequest("POST", "/documents", {
    document_name: name,
    document_url: url,
    tags: tags || [],
  });
}

async function getDocument(documentId) {
  return tavusRequest("GET", `/documents/${documentId}`);
}

async function listDocuments() {
  return tavusRequest("GET", "/documents");
}

module.exports = {
  tavusRequest,
  createConversation,
  endConversation,
  getConversation,
  sendToolResult,
  createPersona,
  getPersona,
  updatePersona,
  listPersonas,
  listReplicas,
  createDocument,
  getDocument,
  listDocuments,
};
