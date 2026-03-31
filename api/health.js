const { isConfigured: isVfaceConfigured } = require("../vface/config/tavus-config");

module.exports = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "fmofl-command",
    timestamp: new Date().toISOString(),
    agents: {
      vapi: { status: process.env.VAPI_API_KEY ? "configured" : "missing_key" },
      vface: { status: isVfaceConfigured() ? "configured" : "missing_credentials" },
    },
  });
};
