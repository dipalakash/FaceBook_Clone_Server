// models/Group.js

const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  privacy: { type: String, enum: ["Public", "Private"], required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });


module.exports = mongoose.model("Group", groupSchema);

