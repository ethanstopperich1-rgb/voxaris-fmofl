module.exports = (req, res) => {
  res.status(200).json({ status: "ok", service: "fmofl-vapi", timestamp: new Date().toISOString() });
};
