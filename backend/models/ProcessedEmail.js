const mongoose = require("mongoose");

const ProcessedEmailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gmailMessageId: {
      type: String,
      required: true,
    },
    emailSubject: {
      type: String,
    },
    senderEmail: {
      type: String,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
    },
    status: {
      type: String,
      enum: ["processed", "skipped", "error"],
      default: "processed",
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique combination of userId and gmailMessageId
ProcessedEmailSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });

module.exports = mongoose.model("ProcessedEmail", ProcessedEmailSchema);
