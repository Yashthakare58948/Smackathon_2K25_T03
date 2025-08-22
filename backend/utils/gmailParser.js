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

module.exports = { listExpenseEmails, parseEmail };
