const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// const PostSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     content: {
//       type: String,
//       required: function () {
//         return !this.media;
//       },
//     },
//     media: {
//       type: [String], // changed from String to Array of Strings
//       default: [],
//     },

//     // media: {
//     //   type: String,
//     // },

//     mediaType: {
//       type: String,
//       enum: ["image", "video", ""],
//       default: "",
//     },
    
//     likes: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//       },
//     ],
//     comments: [CommentSchema],
//     shares: {
//       type: Number,
//       default: 0,
//     },
//   },
//   { timestamps: true }
// );



const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: function () {
        return !this.media;
      },
    },
    media: {
      type: [String],
      default: [],
    },
    mediaType: {
      type: String,
      enum: ["image", "video", ""],
      default: "",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [CommentSchema],
    shares: {
      type: Number,
      default: 0,
    },

    // ✅ Audit Fields
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    created_on: {
      type: Date,
      default: Date.now,
    },
    updated_on: {
      type: Date,
    },

    // ✅ Soft Delete Flag
    active_flag: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);




module.exports = mongoose.model("Post", PostSchema);
