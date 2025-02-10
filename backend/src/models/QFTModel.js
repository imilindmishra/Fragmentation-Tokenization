const mongoose = require("mongoose");

const QFTSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  original_value: { type: String, required: true },
  fragments: { type: Array, required: true },
  encryption_key: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("QFTToken", QFTSchema);
