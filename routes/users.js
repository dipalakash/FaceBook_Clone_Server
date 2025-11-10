const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Post = require("../models/Post");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// === Multer Config ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user-${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// === GET Logged-in User ===
// @route   GET /api/users/me
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    const DEFAULT_PROFILE_PICTURE = "/uploads/user-photo.jpg";

    const user = await User.findById(req.user.id).populate(
      "friends",
      "firstName lastName profilePicture"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Set default profile picture if not set
    if (!user.profilePicture) {
      user.profilePicture = DEFAULT_PROFILE_PICTURE;
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/me/saved-posts
// @desc    Get saved posts for the logged-in user
// @access  Private

const verifyToken = require("../middleware/auth"); // ✅ use this middleware

// ✅ GET /me/saved-posts — Fetch saved posts for the logged-in user
router.get("/me/saved-posts", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "savedPosts",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture",
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.savedPosts); // returns saved posts with user info
  } catch (err) {
    console.error("Fetch saved posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// === GET User by ID ===
// @route   GET /api/users/:id
// @access  Private
// === SEARCH USERS ===
router.get("/search", auth, async (req, res) => {
  try {
    const query = req.query.q ? req.query.q.trim() : "";

    let users;

    if (query === "") {
      users = await User.find({ _id: { $ne: req.user.id } })
        .select("_id firstName lastName profilePicture email");
    } else {
      users = await User.find({
        $and: [
          {
            $or: [
              { firstName: { $regex: query, $options: "i" } },
              { lastName: { $regex: query, $options: "i" } },
            ],
          },
          { _id: { $ne: req.user.id } },
        ],
      }).select("_id firstName lastName profilePicture email");
    }

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// === GET Posts by User ===
// @route   GET /api/users/:id/posts
// @access  Private
router.get("/:id/posts", auth, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ user: userId })
      .populate("user", "firstName lastName profilePicture")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error("Get user posts error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// === PATCH: Update Profile Picture & Cover Photo ===
// @route   PATCH /api/users/:id/profile
// @access  Private
router.patch(
  "/:id/profile",
  auth,
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "coverPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Ensure the logged-in user is updating their own profile
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updates = {};

      if (req.files.profilePicture) {
        updates.profilePicture = `/uploads/${req.files.profilePicture[0].filename}`;
      }

      if (req.files.coverPhoto) {
        updates.coverPhoto = `/uploads/${req.files.coverPhoto[0].filename}`;
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updates, {
        new: true,
      }).select("-password");

      res.json(updatedUser);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// PUT /api/users/:id/add-friend
router.put("/:id/add-friend", auth, async (req, res) => {
  try {
    const userId = req.user.id; // Logged-in user
    console.log("Dipal id", userId);
    const friendId = req.params.id; // ID of the user to add as friend

    if (userId === friendId) {
      return res
        .status(400)
        .json({ message: "You can't add yourself as a friend." });
    }

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!user || !friend) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ message: "Already friends." });
    }

    // Add friend to user's list
    user.friends.push(friendId);
    await user.save();

    // Optionally: Also add user to friend's list (bidirectional)
    friend.friends.push(userId);
    await friend.save();

    res.json({ message: "Friend added successfully." });
  } catch (err) {
    console.error("Add friend error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//  GET /api/users/:id/friends
router.get("/:id/friends", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "friends",
      "firstName lastName _id"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ friends: user.friends });
  } catch (err) {
    console.error("Error getting friends:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
