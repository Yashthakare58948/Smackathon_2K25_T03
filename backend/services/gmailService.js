const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const GmailToken = require("../models/GmailToken");

class GmailService {
  constructor() {
    this.credentials = require("../config/credentials");
    this.redirectUri =
      process.env.GMAIL_REDIRECT_URI ||
      this.credentials.web.redirect_uris[0] + "/api/gmail/auth/callback";
  }

  // Create OAuth2 client for a specific user
  async createOAuth2Client(userId) {
    try {
      // Get user's Gmail token from database
      const tokenData = await GmailToken.findOne({ userId, isActive: true });

      if (!tokenData) {
        throw new Error(
          "No Gmail token found for this user. Please authenticate with Gmail first."
        );
      }

      // Check if token is expired
      if (Date.now() >= tokenData.expiry_date) {
        // Token is expired, try to refresh it
        const refreshedToken = await this.refreshToken(tokenData);
        if (!refreshedToken) {
          throw new Error(
            "Gmail token has expired. Please re-authenticate with Gmail."
          );
        }
        return refreshedToken;
      }

      const oAuth2Client = new OAuth2(
        this.credentials.web.client_id,
        this.credentials.web.client_secret,
        this.redirectUri
      );

      oAuth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date,
      });

      // Update last used timestamp
      await GmailToken.findByIdAndUpdate(tokenData._id, {
        lastUsed: new Date(),
      });

      return oAuth2Client;
    } catch (error) {
      console.error("Error creating OAuth2 client:", error);
      throw error;
    }
  }

  // Refresh expired token
  async refreshToken(tokenData) {
    try {
      const oAuth2Client = new OAuth2(
        this.credentials.web.client_id,
        this.credentials.web.client_secret,
        this.redirectUri
      );

      oAuth2Client.setCredentials({
        refresh_token: tokenData.refresh_token,
      });

      const { credentials } = await oAuth2Client.refreshAccessToken();

      // Update token in database
      await GmailToken.findByIdAndUpdate(tokenData._id, {
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
        lastUsed: new Date(),
      });

      oAuth2Client.setCredentials(credentials);
      return oAuth2Client;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  }

  // Get Gmail profile for a user
  async getGmailProfile(userId) {
    try {
      const oAuth2Client = await this.createOAuth2Client(userId);
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

      const profile = await gmail.users.getProfile({ userId: "me" });
      return profile.data;
    } catch (error) {
      console.error("Error getting Gmail profile:", error);
      throw error;
    }
  }

  // List expense emails for a specific user
  async listExpenseEmails(userId, searchQueries = null) {
    try {
      const oAuth2Client = await this.createOAuth2Client(userId);
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

      // Get the email address of the authenticated user
      const profile = await gmail.users.getProfile({ userId: "me" });
      console.log("Checking emails for Gmail ID:", profile.data.emailAddress);

      // Default search queries if none provided
      const defaultQueries = [
        "subject:expense OR subject:receipt",
        "expense OR receipt OR payment",
        "transaction OR bill OR invoice",
        // Add date range to avoid processing very old emails repeatedly
        `after:${
          Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
        } (expense OR receipt OR payment)`, // Last 30 days
      ];

      const queries = searchQueries || defaultQueries;
      let allMessages = [];

      for (const query of queries) {
        console.log(`Searching with query: "${query}"`);

        const res = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: 20,
        });

        if (res.data.messages && res.data.messages.length > 0) {
          console.log(
            `Found ${res.data.messages.length} messages with query: "${query}"`
          );
          allMessages = [...allMessages, ...res.data.messages];
          break; // Use the first successful query
        }
      }

      // Remove duplicates based on message id
      const uniqueMessages = allMessages.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id)
      );

      console.log(`Total unique messages found: ${uniqueMessages.length}`);
      return uniqueMessages;
    } catch (error) {
      console.error("Error listing emails:", error);
      throw error;
    }
  }

  // Parse a specific email for a user
  async parseEmail(userId, messageId) {
    try {
      const oAuth2Client = await this.createOAuth2Client(userId);
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

      const res = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const payload = res.data.payload;
      const headers = {};

      // Extract headers
      if (payload.headers) {
        payload.headers.forEach((header) => {
          headers[header.name.toLowerCase()] = header.value;
        });
      }

      console.log(`Email from: ${headers.from}, Subject: ${headers.subject}`);

      let body = "";

      // Function to extract text from email parts
      function extractTextFromParts(parts) {
        let text = "";

        if (!parts) return text;

        for (const part of parts) {
          if (part.mimeType === "text/plain" && part.body && part.body.data) {
            text += Buffer.from(part.body.data, "base64").toString("utf-8");
          } else if (
            part.mimeType === "text/html" &&
            part.body &&
            part.body.data &&
            !text
          ) {
            // Use HTML as fallback if no plain text
            const htmlText = Buffer.from(part.body.data, "base64").toString(
              "utf-8"
            );
            // Basic HTML to text conversion
            text += htmlText
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          } else if (part.parts) {
            // Recursive call for nested parts
            text += extractTextFromParts(part.parts);
          }
        }

        return text;
      }

      if (payload.parts && payload.parts.length > 0) {
        // Multipart email
        body = extractTextFromParts(payload.parts);
      } else if (payload.body && payload.body.data) {
        // Simple email
        const rawBody = Buffer.from(payload.body.data, "base64").toString(
          "utf-8"
        );
        // If it's HTML, do basic conversion to text
        if (payload.mimeType === "text/html") {
          body = rawBody
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        } else {
          body = rawBody;
        }
      }

      console.log(`Email body length: ${body.length}`);
      console.log(`Email body preview: ${body.substring(0, 300)}...`);

      return {
        headers,
        body,
        messageId,
      };
    } catch (error) {
      console.error("Error parsing email:", error);
      throw error;
    }
  }

  // Store Gmail token for a user
  async storeToken(userId, tokenData, gmailEmail) {
    try {
      const token = new GmailToken({
        userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date,
        gmailEmail,
      });

      await token.save();
      console.log(`Gmail token stored for user ${userId} (${gmailEmail})`);
      return token;
    } catch (error) {
      console.error("Error storing Gmail token:", error);
      throw error;
    }
  }

  // Check if user has Gmail token
  async hasToken(userId) {
    try {
      const token = await GmailToken.findOne({ userId, isActive: true });
      return !!token;
    } catch (error) {
      console.error("Error checking Gmail token:", error);
      return false;
    }
  }

  // Get user's Gmail email
  async getGmailEmail(userId) {
    try {
      const token = await GmailToken.findOne({ userId, isActive: true });
      return token ? token.gmailEmail : null;
    } catch (error) {
      console.error("Error getting Gmail email:", error);
      return null;
    }
  }

  // Remove Gmail token for a user
  async removeToken(userId) {
    try {
      await GmailToken.findOneAndUpdate(
        { userId },
        { isActive: false },
        { new: true }
      );
      console.log(`Gmail token deactivated for user ${userId}`);
    } catch (error) {
      console.error("Error removing Gmail token:", error);
      throw error;
    }
  }
}

module.exports = new GmailService();
