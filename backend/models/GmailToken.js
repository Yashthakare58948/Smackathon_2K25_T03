const mongoose = require("mongoose");

const GmailTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  access_token: {
    type: String,
    required: true
  },
  refresh_token: {
    type: String,
    required: true
  },
  scope: {
    type: String,
    required: true
  },
  token_type: {
    type: String,
    default: "Bearer"
  },
  expiry_date: {
    type: Number,
    required: true
  },
  gmailEmail: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fast lookups
GmailTokenSchema.index({ userId: 1 });
GmailTokenSchema.index({ gmailEmail: 1 });

module.exports = mongoose.model("GmailToken", GmailTokenSchema);
