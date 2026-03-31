/**
 * Google Sheets logger for V·FACE intake sessions.
 * Logs completed intake forms to the "V·FACE Intakes" tab.
 * Reuses the same Google Sheets infrastructure as VAPI.
 */

const SHEET_ID = (process.env.GOOGLE_SHEET_ID || "").trim();
const GOOGLE_API_KEY = (process.env.GOOGLE_API_KEY || "").trim();

function nowET() {
  return new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
}

async function appendRow(tab, values) {
  if (!SHEET_ID || !GOOGLE_API_KEY) {
    console.warn("[sheets-logger] GOOGLE_SHEET_ID or GOOGLE_API_KEY not set — skipping");
    return false;
  }

  const range = `${tab}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${GOOGLE_API_KEY}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.ok) {
      console.log(`[sheets-logger] Logged to ${tab}`);
      return true;
    } else {
      const err = await resp.text();
      console.warn(`[sheets-logger] Failed ${resp.status}: ${err.slice(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.warn(`[sheets-logger] Error: ${err.message}`);
    return false;
  }
}

async function logIntakeToSheet(intakeData) {
  return appendRow("V·FACE Intakes", [
    nowET(),
    "Virtual Concierge",
    intakeData.full_name || "",
    intakeData.date_of_birth || "",
    intakeData.insurance_provider || "",
    intakeData.reason_for_visit || "",
    intakeData.medical_history || "",
    (intakeData.symptoms || []).join(", "),
    intakeData.conversation_id || "",
    "Pending — enter into Practice Fusion",
  ]);
}

module.exports = { logIntakeToSheet, appendRow };
