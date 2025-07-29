const mongoose = require("mongoose");

const tempUserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  otp: String,
  profilePicture: String,
  createdAt: { type: Date, default: Date.now, expires: 300 }, // expires in 5 min
});

module.exports = mongoose.model("TemporaryUser", tempUserSchema);