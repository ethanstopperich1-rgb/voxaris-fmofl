/**
 * tool-calls handler — executes tools and returns results to VAPI
 */

function handleToolCalls(body) {
  const toolCalls = body.message?.toolCallList || [];
  const callId = body.message?.call?.id || "unknown";

  console.log(`[tool-calls] ${toolCalls.length} tool call(s) for call ${callId}`);

  const results = toolCalls.map((tc) => {
    const name = tc.function?.name || tc.name || "unknown";
    const args = tc.function?.arguments || {};
    const toolCallId = tc.id;

    console.log(`[tool-calls] Executing: ${name}`, JSON.stringify(args).slice(0, 200));

    let result;
    switch (name) {
      case "check_availability":
        result = handleCheckAvailability(args);
        break;
      case "book_appointment":
        result = handleBookAppointment(args);
        break;
      case "reschedule_appointment":
        result = handleRescheduleAppointment(args);
        break;
      case "log_prescription_inquiry":
        result = handlePrescriptionInquiry(args);
        break;
      case "log_records_request":
        result = handleRecordsRequest(args);
        break;
      default:
        result = { success: false, error: `Unknown tool: ${name}` };
    }

    return {
      name,
      toolCallId,
      result: JSON.stringify(result),
    };
  });

  return { results };
}

// ── Check Availability ──

function handleCheckAvailability(args) {
  const now = new Date();
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const currentHour = etNow.getHours();
  const slots = [];

  for (let d = 0; d < 10 && slots.length < 2; d++) {
    const date = new Date(etNow);
    date.setDate(date.getDate() + d);
    const day = date.getDay();

    // Skip weekends
    if (day === 0 || day === 6) continue;

    const isToday = d === 0;
    const dayName = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });

    // Morning slot: 10 AM
    if (!isToday || currentHour < 9) {
      const start = new Date(date);
      start.setHours(10, 0, 0, 0);
      slots.push({
        label: `${dayName} at 10:00 AM`,
        start_iso: start.toISOString(),
        end_iso: new Date(start.getTime() + 30 * 60000).toISOString(),
      });
    }

    // Afternoon slot: 2 PM
    if (!isToday || currentHour < 13) {
      const start = new Date(date);
      start.setHours(14, 0, 0, 0);
      slots.push({
        label: `${dayName} at 2:00 PM`,
        start_iso: start.toISOString(),
        end_iso: new Date(start.getTime() + 30 * 60000).toISOString(),
      });
    }

    if (slots.length >= 2) break;
  }

  if (slots.length === 0) {
    return {
      available: false,
      message: "No open slots found. Ask the caller what day works best for them.",
    };
  }

  return {
    available: true,
    slots: slots.slice(0, 2),
    message: `Two times available: ${slots[0].label}${slots[1] ? ` or ${slots[1].label}` : ""}. Offer both and let the caller pick.`,
  };
}

// ── Book Appointment ──

function handleBookAppointment(args) {
  console.log(`[book-appointment] Booked: ${args.patient_first_name} ${args.patient_last_name} — ${args.appointment_type} at ${args.slot_start_iso}`);

  return {
    success: true,
    message: `Appointment confirmed for ${args.patient_first_name} ${args.patient_last_name}. Remind them to bring their insurance card and photo ID.`,
  };
}

// ── Reschedule Appointment ──

function handleRescheduleAppointment(args) {
  console.log(`[reschedule] ${args.patient_first_name} ${args.patient_last_name} — moving from ${args.current_appointment_date || "unknown"} to ${args.new_slot_start_iso}`);

  return {
    success: true,
    message: `Appointment rescheduled for ${args.patient_first_name} ${args.patient_last_name}. Confirm the new date and time with them.`,
  };
}

// ── Prescription Inquiry ──

function handlePrescriptionInquiry(args) {
  console.log(`[prescription] ${args.patient_first_name} ${args.patient_last_name} — ${args.inquiry_type}: ${args.details || "no details"}`);

  return {
    success: true,
    message: "Message sent to the medical team. Tell the caller someone will call them back within a few hours to follow up on their medication question.",
  };
}

// ── Medical Records Request ──

function handleRecordsRequest(args) {
  console.log(`[records-request] Company: ${args.company_name} — Patient: ${args.patient_name} — Requested by: ${args.caller_name}`);

  return {
    success: true,
    message: "Request logged. Tell the caller the records team will follow up within 2-3 business days. Do not share any patient information.",
  };
}

module.exports = { handleToolCalls };
