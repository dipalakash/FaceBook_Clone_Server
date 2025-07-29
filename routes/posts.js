const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/Post");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const DEFAULT_PROFILE_PICTURE = "/uploads/user-photo.jpg";

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `post-${uuidv4()}${ext}`);
  },
});
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper: Apply default profile picture
const applyDefaultProfile = (user) => {
  if (!user) {
    return {
      _id: "deleted",
      firstName: "Deleted",
      lastName: "User",
      profilePicture: DEFAULT_PROFILE_PICTURE,
    };
  }
  if (!user.profilePicture) {
    user.profilePicture = DEFAULT_PROFILE_PICTURE;
  }
  return user;
};

// @route GET /api/posts
router.get("/", auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "firstName lastName profilePicture")
      .populate("comments.user", "firstName lastName profilePicture");

    const validatedPosts = posts.map((post) => {
      post.user = applyDefaultProfile(post.user);
      post.comments = post.comments.map((comment) => {
        comment.user = applyDefaultProfile(comment.user);
        return comment;
      });
      return post;
    });

    res.json(validatedPosts);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// router.post("/", [auth, upload.array("media", 5)], async (req, res) => {
//   try {
//     const { content } = req.body;

//     // Store multiple media file paths
//     const mediaPaths = req.files?.map((file) => `/uploads/${file.filename}`) || [];

//     const newPost = new Post({
//       user: req.user.id,
//       content,
//       media: mediaPaths, // media is now an array
//       mediaType: "image", // optionally: can infer from mimetype
//     });

//     const post = await newPost.save();
//     await post.populate("user", "firstName lastName profilePicture");

//     post.user = applyDefaultProfile(post.user);
//     res.status(201).json(post);
//   } catch (error) {
//     console.error("Create post error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });
router.post("/", [auth, upload.array("media", 5)], async (req, res) => {
  try {
    const { content } = req.body;

    const mediaPaths = req.files?.map((file) => `/uploads/${file.filename}`) || [];

    // Detect mediaType from first file
    let mediaType = "";
    if (req.files.length > 0) {
      const firstMime = req.files[0].mimetype;
      if (firstMime.startsWith("image/")) mediaType = "image";
      else if (firstMime.startsWith("video/")) mediaType = "video";
    }

    const newPost = new Post({
      user: req.user.id,
      content,
      media: mediaPaths,
      mediaType,
    });

    const post = await newPost.save();
    await post.populate("user", "firstName lastName profilePicture");

    post.user = applyDefaultProfile(post.user);
    res.status(201).json(post);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// @route GET /api/posts/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "firstName lastName profilePicture")
      .populate("comments.user", "firstName lastName profilePicture");

    if (!post) return res.status(404).json({ message: "Post not found" });

    post.user = applyDefaultProfile(post.user);
    post.comments = post.comments.map((c) => {
      c.user = applyDefaultProfile(c.user);
      return c;
    });

    res.json(post);
  } catch (error) {
    console.error("Get post error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route GET /api/posts/:id/likes
router.get("/:id/likes", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const likeUsers = await User.find(
      { _id: { $in: post.likes } },
      "firstName lastName profilePicture"
    );

    const usersWithDefaults = likeUsers.map(applyDefaultProfile);

    res.json(usersWithDefaults);
  } catch (error) {
    console.error("Get likes error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route PUT /api/posts/:id/like
router.put("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const liked = post.likes.includes(req.user.id);
    if (liked) {
      post.likes.pull(req.user.id);
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();
    await post.populate("user", "firstName lastName profilePicture");
    await post.populate("comments.user", "firstName lastName profilePicture");

    post.user = applyDefaultProfile(post.user);
    post.comments = post.comments.map((c) => {
      c.user = applyDefaultProfile(c.user);
      return c;
    });

    res.json(post);
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route POST /api/posts/:id/comment
router.post("/:id/comment", auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content)
      return res.status(400).json({ message: "Content is required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.unshift({ user: req.user.id, content });
    await post.save();

    await post.populate("user", "firstName lastName profilePicture");
    await post.populate("comments.user", "firstName lastName profilePicture");

    post.user = applyDefaultProfile(post.user);
    post.comments = post.comments.map((c) => {
      c.user = applyDefaultProfile(c.user);
      return c;
    });

    res.json(post);
  } catch (error) {
    console.error("Comment post error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// @route PUT /api/posts/:id
// router.put("/:id", auth, async (req, res) => {
//   try {
//     const { content } = req.body;
//     const post = await Post.findById(req.params.id);

//     if (!post) return res.status(404).json({ message: "Post not found" });
//     if (post.user.toString() !== req.user.id)
//       return res.status(403).json({ message: "Unauthorized" });

//     post.content = content;
//     await post.save();

//     await post.populate("user", "firstName lastName profilePicture");
//     await post.populate("comments.user", "firstName lastName profilePicture");

//     post.user = applyDefaultProfile(post.user);
//     post.comments = post.comments.map((c) => {
//       c.user = applyDefaultProfile(c.user);
//       return c;
//     });

//     res.json(post);
//   } catch (error) {
//     console.error("Edit post error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// --------------------------------->

// @route PUT /api/posts/:id
router.put("/:id", [auth, upload.array("media", 5)], async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    // Update content if provided
    if (content) {
      post.content = content;
    }

    // If new media is uploaded, replace old media
    if (req.files && req.files.length > 0) {
      // Delete all old media files
      if (Array.isArray(post.media)) {
        post.media.forEach((filePath) => {
          const fullPath = path.join(__dirname, "..", filePath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        });
      } else if (post.media) {
        // If older posts had a single string
        const fullPath = path.join(__dirname, "..", post.media);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }

      // Assign new uploaded files
      post.media = req.files.map((file) => `/uploads/${file.filename}`);
      post.mediaType = "image";
    }

    await post.save();
    await post.populate("user", "firstName lastName profilePicture");
    await post.populate("comments.user", "firstName lastName profilePicture");

    post.user = applyDefaultProfile(post.user);
    post.comments = post.comments.map((c) => {
      c.user = applyDefaultProfile(c.user);
      return c;
    });

    res.json(post);
  } catch (error) {
    console.error("Edit post with media error:", error);
    res.status(500).json({ message: "Server error" });
  }
});




// DELETE /api/posts/:id
// DELETE /api/posts/:postId/media



router.delete("/:postId/media", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Ensure user is owner of the post
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Remove the image URL from the media array
    post.media = post.media.filter((url) => url !== imageUrl);

    // Delete the file from the filesystem (optional)
    const fs = require("fs");
    const path = require("path");
    const imagePath = path.join(__dirname, "..", imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await post.save();
    res.status(200).json({ message: "Image removed", updatedMedia: post.media });
  } catch (err) {
    console.error("Error deleting image from post:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if current user is the owner of the post
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await post.deleteOne(); // ✅ deletes the post from DB
    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ message: "Server error" });
  }
});







module.exports = router;
