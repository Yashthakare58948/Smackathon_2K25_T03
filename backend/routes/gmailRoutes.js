const express = require("express");
const { extractExpenseData } = require("../utils/gmailParser");
const gmailService = require("../services/gmailService");
const Expense = require("../models/Expense");
const User = require("../models/User");
const ProcessedEmail = require("../models/ProcessedEmail");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

// In-memory storage for tracking active imports (in production, use Redis)
const activeImports = new Map();
const importCooldown = 30000; // 30 seconds cooldown between imports

// Helper function to check if email has been processed before (PERMANENT tracking)
async function isEmailAlreadyProcessed(userId, gmailMessageId) {
  const processedEmail = await ProcessedEmail.findOne({
    userId: userId,
    gmailMessageId: gmailMessageId,
  });

  if (processedEmail) {
    console.log(
      `Email already processed permanently: ${gmailMessageId} (processed at: ${processedEmail.processedAt})`
    );
    return true;
  }

  return false;
}

// Helper function to mark email as processed
async function markEmailAsProcessed(
  userId,
  emailData,
  expenseId = null,
  status = "processed"
) {
  try {
    const processedEmail = new ProcessedEmail({
      userId: userId,
      gmailMessageId: emailData.messageId,
      emailSubject: emailData.headers.subject,
      senderEmail: emailData.headers.from,
      expenseId: expenseId,
      status: status,
    });

    await processedEmail.save();
    console.log(`Marked email as processed: ${emailData.messageId}`);
  } catch (error) {
    console.error(`Error marking email as processed: ${error.message}`);
  }
}

// Helper function to check for expense duplicates (additional safety)
async function isDuplicateExpense(expenseData, userId, emailData) {
  // Check 1: Exact match (title, amount, date, userId)
  const exactMatch = await Expense.findOne({
    userId: userId,
    title: expenseData.title,
    amount: expenseData.amount,
    date: {
      $gte: new Date(
        expenseData.date.getFullYear(),
        expenseData.date.getMonth(),
        expenseData.date.getDate()
      ),
      $lt: new Date(
        expenseData.date.getFullYear(),
        expenseData.date.getMonth(),
        expenseData.date.getDate() + 1
      ),
    },
  });

  if (exactMatch) {
    console.log(
      `Exact duplicate found: ${expenseData.title} - ₹${expenseData.amount}`
    );
    return true;
  }

  // Check 2: Gmail message ID in expense description (legacy check)
  const gmailIdMatch = await Expense.findOne({
    userId: userId,
    description: { $regex: emailData.messageId },
  });

  if (gmailIdMatch) {
    console.log(
      `Gmail message already processed (legacy): ${emailData.messageId}`
    );
    return true;
  }

  return false;
}

// Middleware to prevent duplicate requests
function preventDuplicateImports(req, res, next) {
  const userId = req.user?.id || "anonymous";
  const now = Date.now();

  // Check if user has an active import
  if (activeImports.has(userId)) {
    const lastImport = activeImports.get(userId);
    const timeSinceLastImport = now - lastImport;

    if (timeSinceLastImport < importCooldown) {
      const remainingTime = Math.ceil(
        (importCooldown - timeSinceLastImport) / 1000
      );
      return res.status(429).json({
        message: `Please wait ${remainingTime} seconds before importing again. Import already in progress.`,
        cooldownRemaining: remainingTime,
      });
    }
  }

  // Mark this user as having an active import
  activeImports.set(userId, now);

  // Clean up old entries (older than 5 minutes)
  for (const [key, timestamp] of activeImports.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      activeImports.delete(key);
    }
  }

  next();
}

router.get(
  "/fetch-expenses",
  protect,
  preventDuplicateImports,
  async (req, res) => {
    const userId = req.user?.id || "anonymous";

    try {
      console.log("Starting Gmail expense fetch for user:", userId);

      // Check if user has Gmail connected
      const hasToken = await gmailService.hasToken(userId);
      if (!hasToken) {
        activeImports.delete(userId);
        return res.status(400).json({
          message: "Gmail account not connected. Please connect your Gmail account first.",
          error: "GMAIL_NOT_CONNECTED"
        });
      }

      const messages = await gmailService.listExpenseEmails(userId);
      console.log(`Retrieved ${messages.length} messages from Gmail`);

      if (messages.length === 0) {
        // Clear the active import flag
        activeImports.delete(userId);

        return res.json({
          message: "No expense emails found",
          expenses: [],
          totalMessagesFound: 0,
          totalExpensesImported: 0,
          duplicatesSkipped: 0,
        });
      }

      const expenses = [];
      const errors = [];
      let duplicatesSkipped = 0;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        console.log(
          `Processing message ${i + 1}/${messages.length}: ${msg.id}`
        );

        try {
          // Parse email and get both body and headers
          const emailData = await gmailService.parseEmail(userId, msg.id);

          if (!emailData.body) {
            console.warn(`No body found for message ${msg.id}`);
            errors.push(`No body found for message ${msg.id}`);
            // Mark as processed even if no body (to avoid re-processing)
            await markEmailAsProcessed(userId, emailData, null, "error");
            continue;
          }

          // PERMANENT CHECK: Check if this email has been processed before
          const alreadyProcessed = await isEmailAlreadyProcessed(
            userId,
            emailData.messageId
          );
          if (alreadyProcessed) {
            console.log(
              `Email already processed permanently: ${emailData.messageId}`
            );
            duplicatesSkipped++;
            continue;
          }

          const expenseData = extractExpenseData(emailData);

          // Skip if no valid amount found
          if (!expenseData.amount || expenseData.amount <= 0) {
            console.warn(
              `Invalid or zero amount for message ${msg.id}:`,
              expenseData
            );
            errors.push(`Invalid or zero amount for message ${msg.id}`);
            // Mark as processed even if no valid amount (to avoid re-processing)
            await markEmailAsProcessed(userId, emailData, null, "skipped");
            continue;
          }

          // Additional duplicate check for safety
          const isDuplicate = await isDuplicateExpense(
            expenseData,
            userId,
            emailData
          );

          if (isDuplicate) {
            console.log(
              `Duplicate expense skipped: ${expenseData.title} - ₹${expenseData.amount}`
            );
            duplicatesSkipped++;
            // Mark as processed to avoid re-processing
            await markEmailAsProcessed(userId, emailData, null, "skipped");
            continue;
          }

          // Create new expense
          const newExpense = new Expense({
            title: expenseData.title,
            amount: expenseData.amount,
            date: expenseData.date,
            category: "Gmail Import",
            description: `Imported from Gmail | Message ID: ${
              emailData.messageId
            }${expenseData.vendor ? " | Vendor: " + expenseData.vendor : ""}`,
            userId: userId,
          });

          await newExpense.save();
          expenses.push(newExpense);

          // PERMANENT MARK: Mark this email as processed with the expense ID
          await markEmailAsProcessed(
            userId,
            emailData,
            newExpense._id,
            "processed"
          );

          console.log(
            `Saved expense: ${expenseData.title} - ₹${expenseData.amount}`
          );
        } catch (msgError) {
          console.error(`Error processing message ${msg.id}:`, msgError);
          errors.push(
            `Error processing message ${msg.id}: ${msgError.message}`
          );
          // Mark as processed even on error (to avoid re-processing)
          try {
            await markEmailAsProcessed(userId, emailData, null, "error");
          } catch (markError) {
            console.error(
              `Error marking email as processed: ${markError.message}`
            );
          }
        }
      }

      // Clear the active import flag
      activeImports.delete(userId);

      res.json({
        message: `Processed ${messages.length} emails, imported ${expenses.length} expenses, skipped ${duplicatesSkipped} duplicates`,
        expenses,
        errors: errors.length > 0 ? errors : undefined,
        totalMessagesFound: messages.length,
        totalExpensesImported: expenses.length,
        duplicatesSkipped: duplicatesSkipped,
      });
    } catch (err) {
      // Clear the active import flag on error
      activeImports.delete(userId);

      console.error("Gmail fetch error:", err);
      res.status(500).json({
        error: err.message,
        message: "Failed to fetch expenses from Gmail",
      });
    }
  }
);

// Endpoint to check import status
router.get("/import-status", protect, (req, res) => {
  const userId = req.user.id;
  const now = Date.now();

  if (activeImports.has(userId)) {
    const lastImport = activeImports.get(userId);
    const timeSinceLastImport = now - lastImport;

    if (timeSinceLastImport < importCooldown) {
      const remainingTime = Math.ceil(
        (importCooldown - timeSinceLastImport) / 1000
      );
      return res.json({
        isImporting: true,
        cooldownRemaining: remainingTime,
        message: `Import in progress. Please wait ${remainingTime} seconds.`,
      });
    }
  }

  res.json({
    isImporting: false,
    cooldownRemaining: 0,
    message: "Ready to import",
  });
});

// Endpoint to view processed emails history
router.get("/processed-emails", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const processedEmails = await ProcessedEmail.find({ userId })
      .sort({ processedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("expenseId", "title amount date");

    const totalCount = await ProcessedEmail.countDocuments({ userId });

    res.json({
      processedEmails,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching processed emails:", error);
    res.status(500).json({
      message: "Failed to fetch processed emails history",
      error: error.message,
    });
  }
});

// Endpoint to clear processed emails history (optional - for testing)
router.delete("/clear-processed-emails", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedCount = await ProcessedEmail.deleteMany({ userId });

    res.json({
      message: `Cleared ${deletedCount.deletedCount} processed email records`,
      deletedCount: deletedCount.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing processed emails:", error);
    res.status(500).json({
      message: "Failed to clear processed emails history",
      error: error.message,
    });
  }
});

module.exports = router;
