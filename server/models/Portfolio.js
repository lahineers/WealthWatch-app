const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  symbol:   { type: String, required: true },
  qty:      { type: Number, required: true },
  price:    { type: Number, required: true },
  category: { type: String, required: true },
  date:     { type: String }
});

const portfolioSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  transactions: [transactionSchema]
});

module.exports = mongoose.model("Portfolio", portfolioSchema);