/**
 * VAPI Tool Definitions for Family Medicine of Orlando (FMOFL)
 * Single inbound assistant — Dr. Daniel Hay
 *
 * Tools handle: scheduling, rescheduling, prescription inquiries,
 * medical records requests, telehealth booking, and transfer.
 */

// ─── Scheduling ─────────────────────────────────────────────────────

const TOOL_CHECK_AVAILABILITY = {
  type: "function",
  function: {
    name: "check_availability",
    description:
      "Check real-time availability on the practice calendar. Returns open appointment slots. Call this BEFORE offering any times to the caller. Always present available slots from the result — never invent times.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: [
            "primary_care_new",
            "primary_care_returning",
            "follow_up",
            "immigration_exam",
            "school_physical",
            "injection_testosterone",
            "injection_weight_control",
            "injection_joint",
            "minor_surgery",
            "telehealth",
            "general",
          ],
          description: "Type of appointment to check slots for.",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level. High = next 3 days. Low = next 14 days.",
        },
        preferred_time_of_day: {
          type: "string",
          enum: ["no_preference", "morning", "afternoon"],
          description: "Caller's preferred time of day.",
        },
        preferred_days: {
          type: "array",
          items: {
            type: "string",
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
          description: "Preferred days. Office is open Monday through Friday.",
        },
      },
      required: ["appointment_type"],
    },
  },
  messages: [
    { type: "request-start", content: "Let me check the schedule for you." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I'm having trouble checking the schedule. Let me connect you with the office.",
    },
  ],
  async: false,
};

const TOOL_BOOK_APPOINTMENT = {
  type: "function",
  function: {
    name: "book_appointment",
    description:
      "Book a confirmed appointment. Only call AFTER the caller chose a specific slot from check_availability and provided their name and phone number.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: [
            "primary_care_new",
            "primary_care_returning",
            "follow_up",
            "immigration_exam",
            "school_physical",
            "injection_testosterone",
            "injection_weight_control",
            "injection_joint",
            "minor_surgery",
            "telehealth",
            "general",
          ],
          description: "Type of appointment.",
        },
        slot_start_iso: {
          type: "string",
          description: "Start time in ISO 8601 format from the chosen slot.",
        },
        patient_first_name: { type: "string", description: "Caller's first name." },
        patient_last_name: { type: "string", description: "Caller's last name." },
        patient_phone: { type: "string", description: "Caller's phone number." },
        patient_email: { type: "string", description: "Caller's email (optional)." },
        patient_type: {
          type: "string",
          enum: ["new", "returning", "unknown"],
          description: "New or returning patient.",
        },
        notes: { type: "string", description: "Additional notes." },
      },
      required: ["appointment_type", "slot_start_iso", "patient_first_name", "patient_last_name", "patient_phone"],
    },
  },
  messages: [
    { type: "request-start", content: "I'm booking that for you now." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I had trouble completing the booking. Let me transfer you to the office.",
    },
  ],
  async: false,
};

// ─── Rescheduling ───────────────────────────────────────────────────

const TOOL_RESCHEDULE_APPOINTMENT = {
  type: "function",
  function: {
    name: "reschedule_appointment",
    description:
      "Reschedule an existing appointment. Collect the patient's name, date of birth, their current appointment date, and the new slot they want. The office will confirm the change.",
    parameters: {
      type: "object",
      properties: {
        patient_first_name: { type: "string", description: "Patient's first name." },
        patient_last_name: { type: "string", description: "Patient's last name." },
        patient_dob: { type: "string", description: "Patient's date of birth for verification." },
        current_appointment_date: { type: "string", description: "The date of the existing appointment to reschedule." },
        new_slot_start_iso: { type: "string", description: "New appointment time in ISO 8601 from check_availability." },
        reason: { type: "string", description: "Reason for rescheduling (optional)." },
      },
      required: ["patient_first_name", "patient_last_name", "patient_dob", "new_slot_start_iso"],
    },
  },
  messages: [
    { type: "request-start", content: "I'm updating your appointment now." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I had trouble with the reschedule. Let me connect you with the front desk.",
    },
  ],
  async: false,
};

// ─── Prescription / Medication Inquiry ──────────────────────────────

const TOOL_LOG_PRESCRIPTION_INQUIRY = {
  type: "function",
  function: {
    name: "log_prescription_inquiry",
    description:
      "Log a prescription or medication question from a patient. Use when the caller asks about prescriptions being sent, medication refills, whether meds arrived at their pharmacy, or any medication-related question. The medical team will call them back.",
    parameters: {
      type: "object",
      properties: {
        patient_first_name: { type: "string", description: "Patient's first name." },
        patient_last_name: { type: "string", description: "Patient's last name." },
        patient_dob: { type: "string", description: "Patient's date of birth for verification." },
        patient_phone: { type: "string", description: "Best callback number." },
        inquiry_type: {
          type: "string",
          enum: ["prescription_status", "refill_request", "pharmacy_check", "medication_question", "other"],
          description: "Type of medication inquiry.",
        },
        details: { type: "string", description: "What the patient is asking about — medication name, pharmacy, etc." },
      },
      required: ["patient_first_name", "patient_last_name", "patient_phone", "inquiry_type"],
    },
  },
  messages: [
    { type: "request-start", content: "Let me send that to the medical team." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I had trouble logging that. Let me connect you with someone.",
    },
  ],
  async: false,
};

// ─── Medical Records Request ────────────────────────────────────────

const TOOL_LOG_RECORDS_REQUEST = {
  type: "function",
  function: {
    name: "log_records_request",
    description:
      "Log a medical records request from a company or third party. Capture the requester's info and what records they need. The records team will follow up. Never release patient information on the call.",
    parameters: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Name of the company requesting records." },
        caller_name: { type: "string", description: "Name of the person calling." },
        caller_phone: { type: "string", description: "Phone number for follow-up." },
        caller_fax: { type: "string", description: "Fax number if provided (optional)." },
        caller_email: { type: "string", description: "Email if provided (optional)." },
        patient_name: { type: "string", description: "Name of the patient whose records are requested." },
        records_needed: { type: "string", description: "What records they need and for what purpose." },
      },
      required: ["company_name", "caller_name", "caller_phone", "patient_name", "records_needed"],
    },
  },
  messages: [
    { type: "request-start", content: "Let me log that request for you." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I had trouble logging that. Let me connect you with the records team.",
    },
  ],
  async: false,
};

// ─── Transfer & End Call ────────────────────────────────────────────

const TOOL_TRANSFER_TO_HUMAN = {
  type: "transferCall",
  destinations: [
    {
      type: "number",
      number: "+14078023233",
      message: "I'm connecting you with the team at Family Medicine of Orlando now. One moment please.",
      description: "Transfer to the office line for live staff. Use when the caller needs something only a human can handle.",
    },
  ],
  messages: [
    { type: "request-start", content: "Let me connect you with someone on the team." },
    { type: "request-complete", content: "Connecting you now." },
    {
      type: "request-failed",
      content: "I'm having trouble connecting you right now. Please call the office directly at four oh seven, eight zero two, three two three three.",
    },
  ],
};

const TOOL_END_CALL = {
  type: "endCall",
  messages: [
    { type: "request-start", content: "Thanks for calling Family Medicine of Orlando. Have a great day!" },
    { type: "request-complete", content: "" },
    { type: "request-failed", content: "" },
  ],
};

// ─── Tool set for the inbound assistant ─────────────────────────────

const INBOUND_TOOLS = [
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_RESCHEDULE_APPOINTMENT,
  TOOL_LOG_PRESCRIPTION_INQUIRY,
  TOOL_LOG_RECORDS_REQUEST,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
];

module.exports = {
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_RESCHEDULE_APPOINTMENT,
  TOOL_LOG_PRESCRIPTION_INQUIRY,
  TOOL_LOG_RECORDS_REQUEST,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
  INBOUND_TOOLS,
};
