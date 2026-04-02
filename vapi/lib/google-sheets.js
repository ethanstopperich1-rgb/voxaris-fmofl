/**
 * Google Sheets logger for FMOFL
 *
 * Logs all agent actions to separate tabs in a shared Google Sheet
 * so the front desk can review and enter into Practice Fusion.
 *
 * Uses Google Sheets API v4 with a Google Service Account (JWT/OAuth2).
 * The sheet must be shared with the service account email address.
 *
 * Tabs:
 *   Appointments  — new bookings
 *   Reschedules   — rescheduled appointments
 *   Prescriptions — medication/prescription inquiries
 *   Records       — medical records requests from companies
 *   Calls         — all call summaries (from end-of-call-report)
 */

const crypto = require("crypto");

const SHEET_ID = (process.env.GOOGLE_SHEET_ID || "").trim();
const GOOGLE_SERVICE_ACCOUNT_EMAIL = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").trim().replace(/\\n/g, "\n");

// ── JWT / OAuth2 token generation for Google API ──

let cachedToken = null;
let tokenExpiresAt = 0;

function base64url(input) {
  const str = typeof input === "string" ? input : input.toString("base64");
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.warn("[google-sheets] Service account credentials not set — cannot authenticate");
    return null;
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const header = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp,
      })
    )
  );

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = base64url(sign.sign(GOOGLE_PRIVATE_KEY, "base64"));

  const jwt = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[google-sheets] Token exchange failed ${resp.status}: ${err.slice(0, 300)}`);
    return null;
  }

  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  console.log("[google-sheets] Service account token acquired");
  return cachedToken;
}

// ── Append a row to a specific tab ──

async function appendRow(tab, values) {
  if (!SHEET_ID) {
    console.warn("[google-sheets] GOOGLE_SHEET_ID not set — skipping log");
    return false;
  }

  const token = await getAccessToken();
  if (!token) {
    console.warn("[google-sheets] No auth token — skipping log");
    return false;
  }

  const range = `${tab}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        values: [values],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.ok) {
      console.log(`[google-sheets] Logged to ${tab}`);
      return true;
    } else {
      const err = await resp.text();
      console.error(`[google-sheets] Failed ${resp.status}: ${err.slice(0, 300)}`);
      return false;
    }
  } catch (err) {
    console.error(`[google-sheets] Error: ${err.message}`);
    return false;
  }
}

// ── Convenience loggers per tab ──

function nowET() {
  return new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
}

async function logAppointment(args) {
  return appendRow("Appointments", [
    nowET(),
    "Inbound Call",
    `${args.patient_first_name || ""} ${args.patient_last_name || ""}`.trim(),
    args.patient_phone || "",
    args.patient_email || "",
    args.appointment_type || "",
    args.slot_start_iso || "",
    args.patient_type || "",
    args.notes || "",
    "Pending — enter into Practice Fusion",
  ]);
}

async function logReschedule(args) {
  return appendRow("Reschedules", [
    nowET(),
    `${args.patient_first_name || ""} ${args.patient_last_name || ""}`.trim(),
    args.patient_dob || "",
    args.current_appointment_date || "",
    args.new_slot_start_iso || "",
    args.reason || "",
    "Pending — update in Practice Fusion",
  ]);
}

async function logPrescriptionInquiry(args) {
  return appendRow("Prescriptions", [
    nowET(),
    `${args.patient_first_name || ""} ${args.patient_last_name || ""}`.trim(),
    args.patient_dob || "",
    args.patient_phone || "",
    args.inquiry_type || "",
    args.details || "",
    "Pending — needs callback",
  ]);
}

async function logRecordsRequest(args) {
  return appendRow("Records", [
    nowET(),
    args.company_name || "",
    args.caller_name || "",
    args.caller_phone || "",
    args.caller_fax || "",
    args.caller_email || "",
    args.patient_name || "",
    args.records_needed || "",
    "Pending — follow up within 2-3 days",
  ]);
}

async function logCallSummary(report) {
  const callId = report.call?.id || "";
  const duration = report.durationSeconds || 0;
  const cost = report.cost || 0;
  const summary = report.summary || "";
  const recording = report.recordingUrl || "";

  return appendRow("Calls", [
    nowET(),
    callId,
    `${duration}s`,
    `$${cost.toFixed(4)}`,
    summary.slice(0, 500),
    recording,
  ]);
}

async function logStructuredData(data) {
  return appendRow("Call Analysis", [
    nowET(),
    data.callId || "",
    data.call_type || "",
    `${data.patient_first_name || ""} ${data.patient_last_name || ""}`.trim(),
    data.patient_phone || "",
    data.patient_type || "",
    data.appointment_type || "",
    data.appointment_booked ? "Yes" : "No",
    data.appointment_datetime || "",
    data.prescription_inquiry_type || "",
    data.transferred_to_human ? "Yes" : "No",
    data.language_used || "",
    data.caller_sentiment || "",
    data.resolution_status || "",
    data.follow_up_needed ? "Yes" : "No",
    data.follow_up_reason || "",
    data.summary || "",
    data.successEvaluation !== null && data.successEvaluation !== undefined ? String(data.successEvaluation) : "",
    `${data.duration || 0}s`,
    `$${(data.cost || 0).toFixed(4)}`,
  ]);
}

// ── Live Session KV (uses "Live_Sessions" tab as a key-value store) ──
// Row format: [conversation_id, json_data, updated_at]
// On write: find existing row for conversation_id and update it, or append
// On read: scan for conversation_id and return parsed JSON

async function putSession(conversationId, data) {
  if (!SHEET_ID) return false;
  const token = await getAccessToken();
  if (!token) return false;

  const jsonStr = JSON.stringify(data);
  const timestamp = nowET();

  // First, try to find existing row for this conversation
  const rowIndex = await findSessionRow(token, conversationId);

  if (rowIndex > 0) {
    // Update existing row
    const range = `Live_Sessions!A${rowIndex}:C${rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
    try {
      const resp = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ values: [[conversationId, jsonStr, timestamp]] }),
        signal: AbortSignal.timeout(10_000),
      });
      return resp.ok;
    } catch { return false; }
  } else {
    // Append new row
    return appendRow("Live_Sessions", [conversationId, jsonStr, timestamp]);
  }
}

async function getSession(conversationId) {
  if (!SHEET_ID || !conversationId) return null;
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const range = `Live_Sessions!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=_&majorDimension=ROWS`;
    const resp = await fetch(
      url.replace("key=_&", ""),
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!resp.ok) return null;

    const body = await resp.json();
    const rows = body.values || [];
    // Find the row matching this conversation_id (column A)
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][0] === conversationId) {
        try { return JSON.parse(rows[i][1]); } catch { return null; }
      }
    }
    return null;
  } catch { return null; }
}

async function deleteSession(conversationId) {
  // We don't actually delete — just leave it. Sessions are small and short-lived.
  // The "Live_Sessions" tab can be periodically cleaned up manually.
  return true;
}

async function findSessionRow(token, conversationId) {
  try {
    const range = `Live_Sessions!A:A`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return -1;

    const body = await resp.json();
    const rows = body.values || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][0] === conversationId) return i + 1; // 1-indexed
    }
    return -1;
  } catch { return -1; }
}

module.exports = {
  logAppointment,
  logReschedule,
  logPrescriptionInquiry,
  logRecordsRequest,
  logCallSummary,
  logStructuredData,
  appendRow,
  getAccessToken,
  putSession,
  getSession,
  deleteSession,
};
