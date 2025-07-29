const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const TemporaryUser = require("../models/TemporaryUser");
const nodemailer = require("nodemailer");

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, `profile-${uuidv4()}${path.extname(file.originalname)}`),
});

const fileFilter = (req, file, cb) => {
  file.mimetype.startsWith("image/")
    ? cb(null, true)
    : cb(new Error("Only images are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/register", upload.single("profilePicture"), async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await TemporaryUser.findOneAndUpdate(
      { email },
      {
        firstName,
        lastName,
        email,
        password,
        otp,
        profilePicture: req.file
          ? `/uploads/${req.file.filename}`
          : "/uploads/user-photo.jpg",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Facebook Clone",
      text: `Your OTP is: ${otp}`,
    });

    res.status(201).json({ message: "OTP sent" });
  } catch (error) {
    console.error("OTP registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const tempUser = await TemporaryUser.findOne({ email });

  if (!tempUser || tempUser.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const newUser = new User({
    firstName: tempUser.firstName,
    lastName: tempUser.lastName, // ✅ Include lastName here!
    email: tempUser.email,
    password: tempUser.password,
    profilePicture: tempUser.profilePicture,
    isVerified: true,
  });

  await newUser.save();

  // Cleanup
  await TemporaryUser.deleteOne({ email });

  res.status(200).json({ message: "Registration successful" });
});

router.get("/verify-email/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      emailVerificationToken: req.params.token,
    });
    if (!user)
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });

    user.isVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ TEMPORARY: Email verification disabled for login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ❌ Commented out email verification check
    // if (!user.isVerified) {
    //   return res.status(401).json({ message: "Email not verified" });
    // }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture,
          },
        });
      }
    );
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
