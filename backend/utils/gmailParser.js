const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const fs = require("fs");
const path = require("path");

const CREDENTIALS = require("../config/credentials");
const TOKEN_PATH = path.join(__dirname, "token.json");

const { client_id, client_secret, redirect_uris } = CREDENTIALS.web;

const oAuth2Client = new OAuth2(
  client_id,
  client_secret,
  "urn:ietf:wg:oauth:2.0:oob"
);

// Load tokens if they exist
if (fs.existsSync(TOKEN_PATH)) {
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  oAuth2Client.setCredentials(tokenData);
} else {
  console.error(
    "Token not found. Run the OOB flow to generate token.json first."
  );
}

async function listExpenseEmails() {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Get the email address of the authenticated user
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("Checking emails for Gmail ID:", profile.data.emailAddress);

    const res = await gmail.users.messages.list({
      userId: "me",
      q: "subject:expense OR subject:receipt",
      maxResults: 10,
    });

    return res.data.messages || [];
  } catch (err) {
    console.error("Error listing emails:", err);
    return [];
  }
}

// Safe parse email
async function parseEmail(messageId) {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const payload = res.data.payload;
    let body = "";

    if (payload.parts && payload.parts.length > 0) {
      // Multipart email
      body = Buffer.from(payload.parts[0].body.data || "", "base64").toString();
    } else if (payload.body && payload.body.data) {
      // Simple email
      body = Buffer.from(payload.body.data, "base64").toString();
    }

    return body;
  } catch (err) {
    console.error("Error parsing email:", err);
    return "";
  }
}

// Extract expense data from email content
function extractExpenseData(emailData) {
  const { body, headers } = emailData;

  // Default values
  let title = "Gmail Import";
  let amount = 0;
  let date = new Date();
  let vendor = "";

  // Try to extract amount from email body
  const amountPatterns = [
    /₹\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, // Indian Rupees
    /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi, // Rs format
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, // US Dollars
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees?|rs|dollars?|usd)/gi, // Amount with currency
    /amount[:\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi, // Amount keyword
    /total[:\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi, // Total keyword
  ];

  let foundAmount = null;
  for (const pattern of amountPatterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      // Extract the first match and clean it
      const amountStr = matches[0].replace(/[^\d.,]/g, "").replace(",", "");
      const parsedAmount = parseFloat(amountStr);
      if (parsedAmount > 0 && parsedAmount < 1000000) {
        // Reasonable amount range
        foundAmount = parsedAmount;
        break;
      }
    }
  }

  if (foundAmount) {
    amount = foundAmount;
  }

  // Try to extract date from email
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g, // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g, // YYYY/MM/DD
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/gi, // DD Month YYYY
  ];

  for (const pattern of datePatterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      const parsedDate = new Date(matches[0]);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
        break;
      }
    }
  }

  // Try to extract vendor/merchant from email
  const vendorPatterns = [
    /from[:\s]*([A-Za-z\s]+)/gi,
    /merchant[:\s]*([A-Za-z\s]+)/gi,
    /vendor[:\s]*([A-Za-z\s]+)/gi,
    /store[:\s]*([A-Za-z\s]+)/gi,
  ];

  for (const pattern of vendorPatterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      vendor = matches[1].trim();
      break;
    }
  }

  // Create title from vendor or subject
  if (vendor) {
    title = `${vendor} - ${amount > 0 ? `₹${amount}` : "Expense"}`;
  } else if (headers.subject) {
    title = headers.subject.substring(0, 50); // Limit length
  }

  return {
    title,
    amount,
    date,
    vendor,
  };
}

module.exports = { listExpenseEmails, parseEmail, extractExpenseData };
