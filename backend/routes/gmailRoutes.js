const express = require("express");
const { listExpenseEmails, parseEmail } = require("../utils/gmailParser");
const router = express.Router();

router.get("/fetch-expenses", async (req, res) => {
  try {
    const messages = await listExpenseEmails();
    const expenses = [];
    for (const msg of messages) {
      const body = await parseEmail(msg.id);
      expenses.push({ raw: body });
    }
    res.json(expenses);
  } catch (err) {
    console.error("Fetch expenses error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
