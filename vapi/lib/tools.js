/**
 * VAPI Tool Definitions for Family Medicine of Orlando (FMOFL)
 * Single inbound assistant — Dr. Daniel Hay's practice
 */

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
            "immigration_exam",
            "school_physical",
            "injection_testosterone",
            "injection_weight_control",
            "injection_joint",
            "minor_surgery",
            "follow_up",
            "general",
          ],
          description: "Type of appointment to check slots for.",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level. High = search next 3 days. Low = search next 14 days.",
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
          description: "Preferred days of the week. Office is open Monday through Friday.",
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
      content: "I'm having a little trouble checking the schedule. Let me connect you with the office.",
    },
  ],
  async: false,
};

const TOOL_BOOK_APPOINTMENT = {
  type: "function",
  function: {
    name: "book_appointment",
    description:
      "Book a confirmed appointment on the practice calendar. Only call this AFTER the caller has chosen a specific slot from check_availability results and provided their name and phone number.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: [
            "primary_care_new",
            "primary_care_returning",
            "immigration_exam",
            "school_physical",
            "injection_testosterone",
            "injection_weight_control",
            "injection_joint",
            "minor_surgery",
            "follow_up",
            "general",
          ],
          description: "Type of appointment.",
        },
        slot_start_iso: {
          type: "string",
          description: "Start time in ISO 8601 format from the chosen slot.",
        },
        slot_end_iso: {
          type: "string",
          description: "End time in ISO 8601 format from the chosen slot.",
        },
        patient_first_name: {
          type: "string",
          description: "Caller's first name.",
        },
        patient_last_name: {
          type: "string",
          description: "Caller's last name.",
        },
        patient_phone: {
          type: "string",
          description: "Caller's phone number.",
        },
        patient_email: {
          type: "string",
          description: "Caller's email address (optional).",
        },
        patient_type: {
          type: "string",
          enum: ["new", "returning", "unknown"],
          description: "Whether the caller is a new or returning patient.",
        },
        notes: {
          type: "string",
          description: "Any additional notes about the appointment.",
        },
      },
      required: [
        "appointment_type",
        "slot_start_iso",
        "patient_first_name",
        "patient_last_name",
        "patient_phone",
      ],
    },
  },
  messages: [
    { type: "request-start", content: "I'm booking that for you now." },
    { type: "request-complete", content: "" },
    {
      type: "request-failed",
      content: "I had trouble completing the booking. Let me transfer you to the office so they can confirm.",
    },
  ],
  async: false,
};

const TOOL_TRANSFER_TO_HUMAN = {
  type: "transferCall",
  destinations: [
    {
      type: "number",
      number: "+14078023233",
      message: "I'm connecting you with the team at Family Medicine of Orlando now. One moment please.",
      description: "Transfer to Family Medicine of Orlando office line for live staff.",
    },
  ],
  messages: [
    {
      type: "request-start",
      content: "Let me connect you with someone on the team.",
    },
    { type: "request-complete", content: "Connecting you now." },
    {
      type: "request-failed",
      content:
        "I'm having trouble connecting you right now. Please call the office directly at four oh seven, eight zero two, three two three three.",
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

// ─── Tool set for the single inbound assistant ──────────────────────

const INBOUND_TOOLS = [
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
];

module.exports = {
  TOOL_CHECK_AVAILABILITY,
  TOOL_BOOK_APPOINTMENT,
  TOOL_TRANSFER_TO_HUMAN,
  TOOL_END_CALL,
  INBOUND_TOOLS,
};
