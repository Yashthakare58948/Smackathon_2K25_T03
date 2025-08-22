const express = require("express");
const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const gmailService = require("../services/gmailService");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

// Gmail OAuth2 configuration
const credentials = require("../config/credentials");
const redirectUri = "https://apifinwell.onrender.com/api/gmail/auth/callback";

// Generate Gmail OAuth2 URL
router.get("/auth/url", protect, (req, res) => {
  try {
    const oAuth2Client = new OAuth2(
      credentials.web.client_id,
      credentials.web.client_secret,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });

    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate Gmail authentication URL",
      error: error.message
    });
  }
});

// Gmail OAuth2 callback
router.get("/auth/callback", protect, async (req, res) => {
  try {
    const { code } = req.query;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required"
      });
    }

    const oAuth2Client = new OAuth2(
      credentials.web.client_id,
      credentials.web.client_secret,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    
    // Get user's Gmail profile
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailEmail = profile.data.emailAddress;

    // Store tokens in database
    await gmailService.storeToken(userId, tokens, gmailEmail);

    // Redirect to frontend with success message
    const frontendUrl = "https://smackathon-2-k25-t03.vercel.app";
    res.redirect(`${frontendUrl}/dashboard?gmail_connected=true&email=${gmailEmail}`);

  } catch (error) {
    console.error("Error in Gmail auth callback:", error);
    const frontendUrl = "https://smackathon-2-k25-t03.vercel.app";
    res.redirect(`${frontendUrl}/dashboard?gmail_error=true&message=${encodeURIComponent(error.message)}`);
  }
});

// Check if user has Gmail connected
router.get("/auth/status", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const hasToken = await gmailService.hasToken(userId);
    const gmailEmail = hasToken ? await gmailService.getGmailEmail(userId) : null;

    res.json({
      success: true,
      connected: hasToken,
      gmailEmail: gmailEmail
    });
  } catch (error) {
    console.error("Error checking Gmail status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check Gmail connection status",
      error: error.message
    });
  }
});

// Disconnect Gmail account
router.delete("/auth/disconnect", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    await gmailService.removeToken(userId);

    res.json({
      success: true,
      message: "Gmail account disconnected successfully"
    });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect Gmail account",
      error: error.message
    });
  }
});

// Test Gmail connection
router.get("/auth/test", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await gmailService.getGmailProfile(userId);

    res.json({
      success: true,
      message: "Gmail connection is working",
      profile: profile
    });
  } catch (error) {
    console.error("Error testing Gmail connection:", error);
    res.status(500).json({
      success: false,
      message: "Gmail connection test failed",
      error: error.message
    });
  }
});

module.exports = router;
