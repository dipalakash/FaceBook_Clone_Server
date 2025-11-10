


const express = require("express");
const Group = require("../models/Group");
const auth = require("../middleware/auth");
const verifyToken=require("../middleware/auth");

const router = express.Router();



router.post("/", auth, async (req, res) => {
  try {
    console.log("Received body:", req.body);
    console.log("Authenticated user:", req.user);

    const { name, privacy, invitedFriends } = req.body;

    const group = new Group({
      name,
      privacy,
      members: [req.user.id, ...(invitedFriends || [])],
      createdBy: req.user.id
    });

    await group.save();
    res.status(201).json(group);
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



router.get("/:id", auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "firstName lastName email  profilePicture")
      .populate("createdBy", "firstName lastName email  profilePicture");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Get all groups for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
      .populate("members", "firstName lastName email  profilePicture")
      .populate("createdBy", "firstName lastName email  profilePicture");

    if (!groups.length) {
      return res.status(200).json([]); // No groups yet
    }

    res.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});





router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }

    // only admin can delete
    if (group.createdBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "Not authorized to delete this group" });
    }

    await Group.findByIdAndDelete(req.params.id);

    res.json({ msg: "✅ Group deleted successfully" });
  } catch (err) {
    console.error("Error deleting group:", err.message);
    res.status(500).json({ msg: "Server error while deleting group" });
  }
});


module.exports = router;
