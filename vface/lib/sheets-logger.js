/**
 * Google Sheets logger for V·FACE intake sessions.
 * Logs completed intake forms to the "V·FACE Intakes" tab.
 * Reuses the shared auth module from the VAPI sheets logger.
 */

const { appendRow: vapiAppendRow } = require("../../vapi/lib/google-sheets");

function nowET() {
  return new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
}

async function logIntakeToSheet(intakeData) {
  return vapiAppendRow("VFace Intakes", [
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

module.exports = { logIntakeToSheet };
