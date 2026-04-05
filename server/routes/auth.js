const express   = require("express");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const User      = require("../models/User");
const Portfolio = require("../models/Portfolio");
const router    = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Fill all fields" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username already taken" });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ username, password: hashed });
    await Portfolio.create({ userId: user._id, transactions: [] });

    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, username });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ error: "Invalid username or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid username or password" });

    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, username });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// VERIFY TOKEN (used by frontend to check if still logged in)
router.get("/verify", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, username: decoded.username });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;