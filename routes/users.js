// const express = require("express");
// const router = express.Router();
// const auth = require("../middleware/auth");
// const User = require("../models/User");
// const Post = require("../models/Post"); // <-- Post model import

// router.get("/me", auth, async (req, res) => {
//   try {
//     const DEFAULT_PROFILE_PICTURE = "/uploads/user-photo.jpg";

//     const user = await User.findById(req.user.id).select("-password");
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Inject default profile picture if missing
//     if (!user.profilePicture) {
//       user.profilePicture = DEFAULT_PROFILE_PICTURE;
//     }

//     res.json(user);
//   } catch (error) {
//     console.error("Get user error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // @route   GET /api/users/:id
// // @desc    Get user by ID
// // @access  Private
// router.get("/:id", auth, async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select("-password");
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     res.json(user);
//   } catch (error) {
//     console.error("Get user by ID error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ===== New route to get posts by user ID =====
// // @route   GET /api/users/:id/posts
// // @desc    Get posts by user ID with user info populated
// // @access  Private
// router.get("/:id/posts", auth, async (req, res) => {
//   try {
//     const userId = req.params.id;

//     // Optional: Check if user exists
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Populate user details in posts
//     const posts = await Post.find({ user: userId })
//       .populate("user", "firstName lastName profilePicture") // <--- populate here
//       .sort({ createdAt: -1 });

//     res.json(posts);
//   } catch (error) {
//     console.error("Get user posts error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;




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

    const user = await User.findById(req.user.id).select("-password");
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

// === GET User by ID ===
// @route   GET /api/users/:id
// @access  Private
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

module.exports = router;
