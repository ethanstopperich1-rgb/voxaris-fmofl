/**
 * Google Sheets logger for FMOFL
 *
 * Logs all agent actions to separate tabs in a shared Google Sheet
 * so the front desk can review and enter into Practice Fusion.
 *
 * Uses Google Sheets API v4 with a service account.
 *
 * Tabs:
 *   Appointments  — new bookings
 *   Reschedules   — rescheduled appointments
 *   Prescriptions — medication/prescription inquiries
 *   Records       — medical records requests from companies
 *   Calls         — all call summaries (from end-of-call-report)
 */

const SHEET_ID = (process.env.GOOGLE_SHEET_ID || "").trim();
const GOOGLE_API_KEY = (process.env.GOOGLE_API_KEY || "").trim();
const GOOGLE_SERVICE_ACCOUNT_EMAIL = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").trim().replace(/\\n/g, "\n");

// ── JWT token generation for Google API ──

async function getAccessToken() {
  if (GOOGLE_API_KEY) {
    // If using API key (simpler but less secure), return null — we'll use key param
    return null;
  }

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    return null;
  }

  // For service account auth, we need to generate a JWT
  // In production, use google-auth-library. For now, fallback to API key.
  return null;
}

// ── Append a row to a specific tab ──

async function appendRow(tab, values) {
  if (!SHEET_ID) {
    console.warn("[google-sheets] GOOGLE_SHEET_ID not set — skipping log");
    return false;
  }

  const range = `${tab}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${GOOGLE_API_KEY}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      console.warn(`[google-sheets] Failed ${resp.status}: ${err.slice(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.warn(`[google-sheets] Error: ${err.message}`);
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

module.exports = {
  logAppointment,
  logReschedule,
  logPrescriptionInquiry,
  logRecordsRequest,
  logCallSummary,
};
