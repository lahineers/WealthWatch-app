const express   = require("express");
const auth      = require("../middleware/auth");
const Portfolio = require("../models/Portfolio");
const router    = express.Router();

// GET transactions for logged-in user
router.get("/transactions", auth, async (req, res) => {
  try {
    console.log("Fetching transactions for user:", req.user.id);
    const portfolio = await Portfolio.findOne({ userId: req.user.id });
    console.log("Portfolio found:", !!portfolio, "Transactions:", portfolio?.transactions?.length || 0);
    res.json(portfolio ? portfolio.transactions : []);
  } catch (e) {
    console.error("GET /portfolio/transactions error:", e.message);
    res.status(500).json({ error: "Server error" });
  }
});

// SAVE all transactions for logged-in user
router.post("/transactions", auth, async (req, res) => {
  try {
    await Portfolio.findOneAndUpdate(
      { userId: req.user.id },
      { transactions: req.body.transactions },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;