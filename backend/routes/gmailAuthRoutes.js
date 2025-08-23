const express = require("express");
const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const jwt = require("jsonwebtoken");
const gmailService = require("../services/gmailService");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
  res.json({
    message: "Gmail auth routes are working!",
    credentials: !!credentials,
    redirectUri: redirectUri,
    clientId: credentials.web.client_id,
    hasClientSecret: !!credentials.web.client_secret,
  });
});

// Gmail OAuth2 configuration
const credentials = require("../config/credentials");
const redirectUri =
  process.env.GMAIL_REDIRECT_URI || credentials.web.redirect_uris[0];

// Generate Gmail OAuth2 URL
router.get("/auth/url", protect, (req, res) => {
  try {
    console.log("Generating Gmail auth URL...");
    console.log("Client ID:", credentials.web.client_id);
    console.log("Redirect URI:", redirectUri);
    console.log("Available redirect URIs:", credentials.web.redirect_uris);

    const oAuth2Client = new OAuth2(
      credentials.web.client_id,
      credentials.web.client_secret,
      redirectUri
    );

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    // Get the JWT token from the authorization header
    const jwtToken = req.headers.authorization?.split(" ")[1];
    if (!jwtToken) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
      });
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent to get refresh token
      state: jwtToken,
    });

    console.log("Generated auth URL:", authUrl);
    console.log("OAuth parameters:", {
      clientId: credentials.web.client_id,
      redirectUri,
      scopes,
      stateLength: jwtToken ? jwtToken.length : 0,
    });

    res.json({
      success: true,
      authUrl: authUrl,
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate Gmail authentication URL",
      error: error.message,
    });
  }
});

// Gmail OAuth2 callback
router.get("/auth/callback", async (req, res) => {
  const frontendUrl =
    process.env.CLIENT_URL || "https://smackathon-2-k25-t03.vercel.app";

  console.log("Frontend URL for redirect:", frontendUrl);

  try {
    const { code, state } = req.query;

    console.log("OAuth callback received:", {
      code: !!code,
      state: !!state,
      query: req.query,
    });

    if (!code || !state) {
      console.error("Missing OAuth parameters:", {
        code: !!code,
        state: !!state,
      });
      return res.redirect(
        `${frontendUrl}/dashboard?gmail_error=true&message=${encodeURIComponent(
          "Missing authorization code or state token"
        )}`
      );
    }

    // Verify JWT from state
    let decoded;
    try {
      console.log("Verifying JWT state parameter...");
      decoded = jwt.verify(state, process.env.JWT_SECRET);
      console.log("JWT verified successfully, user ID:", decoded.id);
    } catch (err) {
      console.error("Invalid or expired JWT in state:", err);
      console.error("State parameter received:", state);
      return res.redirect(
        `${frontendUrl}/dashboard?gmail_error=true&message=${encodeURIComponent(
          "Invalid or expired authentication token"
        )}`
      );
    }

    const userId = decoded.id;

    // Create new OAuth2 client
    const oAuth2Client = new OAuth2(
      credentials.web.client_id,
      credentials.web.client_secret,
      redirectUri
    );

    // Exchange authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);

    // Use credentials to get Gmail profile
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailEmail = profile.data.emailAddress;

    // Store the tokens for this user
    await gmailService.storeToken(userId, tokens, gmailEmail);

    // Redirect back to frontend with success
    res.redirect(
      `${frontendUrl}/dashboard?gmail_connected=true&email=${gmailEmail}`
    );
  } catch (error) {
    console.error("Gmail OAuth callback error:", error);

    res.redirect(
      `${frontendUrl}/dashboard?gmail_error=true&message=${encodeURIComponent(
        error.message || "Unknown error"
      )}`
    );
  }
});

// Check if user has Gmail connected
router.get("/auth/status", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const hasToken = await gmailService.hasToken(userId);
    const gmailEmail = hasToken
      ? await gmailService.getGmailEmail(userId)
      : null;

    res.json({
      success: true,
      connected: hasToken,
      gmailEmail: gmailEmail,
    });
  } catch (error) {
    console.error("Error checking Gmail status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check Gmail connection status",
      error: error.message,
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
      message: "Gmail account disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect Gmail account",
      error: error.message,
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
      profile: profile,
    });
  } catch (error) {
    console.error("Error testing Gmail connection:", error);
    res.status(500).json({
      success: false,
      message: "Gmail connection test failed",
      error: error.message,
    });
  }
});

module.exports = router;
