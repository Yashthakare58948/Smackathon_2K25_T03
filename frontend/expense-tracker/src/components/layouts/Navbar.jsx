import React, { useState, useEffect } from "react";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";
import { useSearchParams } from "react-router-dom";
import SideMenu from "./SideMenu";
import { API_PATHS } from "../../utils/apiPaths";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
const Navbar = ({ activeMenu, onDataRefresh }) => {
  const [openSideMenu, setOpenSideMenu] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    gmailEmail: null,
  });
  const [searchParams] = useSearchParams();

  // Check Gmail connection status
  useEffect(() => {
    checkGmailStatus();
  }, []);

  // Handle OAuth callback redirect parameters
  useEffect(() => {
    const gmailConnected = searchParams.get("gmail_connected");
    const gmailEmail = searchParams.get("email");
    const gmailError = searchParams.get("gmail_error");
    const gmailErrorMessage = searchParams.get("message");

    if (gmailConnected === "true" && gmailEmail) {
      // Gmail connection successful
      setGmailStatus({
        connected: true,
        gmailEmail: gmailEmail,
      });
      toast.success(`Gmail account connected successfully: ${gmailEmail}`);

      // Clean up URL parameters
      const url = new URL(window.location);
      url.searchParams.delete("gmail_connected");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url);
    } else if (gmailError === "true" && gmailErrorMessage) {
      // Gmail connection failed
      toast.error(`Gmail connection failed: ${gmailErrorMessage}`);

      // Clean up URL parameters
      const url = new URL(window.location);
      url.searchParams.delete("gmail_error");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams]);

  const checkGmailStatus = async () => {
    try {
      console.log("Checking Gmail status...");
      const response = await axiosInstance.get(API_PATHS.GMAIL.AUTH_STATUS);
      console.log("Gmail status response:", response.data);
      setGmailStatus({
        connected: response.data.connected,
        gmailEmail: response.data.gmailEmail,
      });
    } catch (error) {
      console.error("Error checking Gmail status:", error);
      setGmailStatus({ connected: false, gmailEmail: null });
    }
  };

  const handleGmailConnect = async () => {
    try {
      console.log("Requesting Gmail auth URL...");
      const response = await axiosInstance.get(API_PATHS.GMAIL.AUTH_URL);
      console.log("Auth URL response:", response.data);

      if (response.data.success) {
        console.log("Opening OAuth popup with URL:", response.data.authUrl);
        // Open Gmail OAuth in new window
        const popup = window.open(
          response.data.authUrl,
          "_blank",
          "width=500,height=600"
        );

        if (!popup) {
          toast.error("Popup blocked! Please allow popups for this site.");
          return;
        }

        // Poll for status changes more frequently
        const pollInterval = setInterval(async () => {
          try {
            // Check if popup was closed by user
            if (popup.closed) {
              console.log("OAuth popup was closed by user");
              clearInterval(pollInterval);
              return;
            }

            const statusResponse = await axiosInstance.get(
              API_PATHS.GMAIL.AUTH_STATUS
            );
            if (statusResponse.data.connected) {
              setGmailStatus({
                connected: statusResponse.data.connected,
                gmailEmail: statusResponse.data.gmailEmail,
              });
              toast.success(
                `Gmail account connected successfully: ${statusResponse.data.gmailEmail}`
              );
              clearInterval(pollInterval);
              popup.close();
            }
          } catch (error) {
            console.error("Error polling Gmail status:", error);
          }
        }, 2000); // Check every 2 seconds

        // Stop polling after 30 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          if (!popup.closed) {
            popup.close();
          }
        }, 30000);
      } else {
        toast.error("Failed to generate Gmail auth URL");
      }
    } catch (error) {
      console.error("Error getting Gmail auth URL:", error);
      console.error("Error details:", error.response?.data);
      toast.error(
        "Failed to connect Gmail account: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  const handleGmailDisconnect = async () => {
    try {
      await axiosInstance.delete(API_PATHS.GMAIL.AUTH_DISCONNECT);
      toast.success("Gmail account disconnected");
      setGmailStatus({ connected: false, gmailEmail: null });
    } catch (error) {
      console.error("Error disconnecting Gmail:", error);
      toast.error("Failed to disconnect Gmail account");
    }
  };

  const handleGmailImport = async () => {
    console.log("Gmail import requested. Status:", gmailStatus);

    // Check if Gmail is connected first
    if (!gmailStatus.connected) {
      toast.error("Please connect your Gmail account first");
      return;
    }

    // Prevent multiple simultaneous requests
    if (isImporting) {
      toast.error("Gmail import already in progress. Please wait...");
      return;
    }

    setIsImporting(true);

    try {
      // First check if import is already in progress
      const statusResponse = await axiosInstance.get(
        API_PATHS.GMAIL.IMPORT_STATUS
      );

      if (statusResponse.data.isImporting) {
        const remainingTime = statusResponse.data.cooldownRemaining;
        toast.error(
          `Import already in progress. Please wait ${remainingTime} seconds.`
        );
        setIsImporting(false);
        return;
      }

      toast.loading("Importing expenses from Gmail...", { id: "gmail-import" });

      const response = await axiosInstance.get(API_PATHS.GMAIL.GMAIL_PARSER);
      const data = response.data;

      // Show success message with import summary
      const totalImported =
        data.totalExpensesImported || data.expenses?.length || 0;
      const duplicatesSkipped = data.duplicatesSkipped || 0;

      toast.success(
        `Import completed! ${totalImported} expenses imported, ${duplicatesSkipped} duplicates skipped.`,
        { id: "gmail-import" }
      );

      console.log("Gmail import result:", data);

      // Refresh dashboard data if callback is provided
      if (onDataRefresh) {
        onDataRefresh();
      }
    } catch (error) {
      console.error("Gmail import error:", error);

      let errorMessage = "Failed to import from Gmail";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error === "GMAIL_NOT_CONNECTED") {
        errorMessage =
          "Gmail account not connected. Please connect your Gmail account first.";
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "Request timed out. Please try again.";
      } else if (error.message === "Network Error") {
        errorMessage = "Network error. Please check your connection.";
      }

      toast.error(errorMessage, { id: "gmail-import" });

      // If there's a connection issue, recheck the Gmail status
      if (error.response?.data?.error === "GMAIL_NOT_CONNECTED") {
        setTimeout(() => {
          checkGmailStatus();
        }, 1000);
      }
    } finally {
      setIsImporting(false);
    }
  };
  return (
    <div className="flex gap-5 bg-white border border-b border-gray-200/50 backdrop-blur-[2px] py-4 px-7 sticky top-0 z-30">
      <button
        className="block lg:hidden text-black"
        onClick={() => {
          setOpenSideMenu(!openSideMenu);
        }}
      >
        {openSideMenu ? (
          <HiOutlineX className="text-2xl" />
        ) : (
          <HiOutlineMenu className="text-2xl" />
        )}
      </button>

      <h2 className="text-lg font-medium text-black">Expense Tracker</h2>

      {openSideMenu && (
        <div className="fixed top-[61px] -ml-4 bg-white">
          <SideMenu activeMenu={activeMenu} />
        </div>
      )}

      {/* Gmail Integration Buttons */}
      <div className="flex items-center gap-2 ml-2">
        {gmailStatus.connected ? (
          <>
            <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
              {gmailStatus.gmailEmail}
            </div>
            <button
              className={`${
                isImporting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600"
              } text-white font-bold py-2 px-4 rounded flex items-center transition-colors duration-200`}
              onClick={handleGmailImport}
              disabled={isImporting}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
                <path
                  fill="#4285F4"
                  d="M44.5 20H24v8.5h11.7C34.7 33.1 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.2 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"
                />
                <path
                  fill="#34A853"
                  d="M6.3 14.7l7 5.1C15.6 16.1 19.5 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.2 6.2 29.4 4 24 4c-6.6 0-12 5.4-12 12 0 2.1.5 4.1 1.3 5.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M24 44c5.8 0 10.7-1.9 14.3-5.2l-6.6-5.4C29.8 36 24 36 24 36c-5.8 0-10.7-1.9-14.3-5.2l6.6-5.4C18.2 33.1 23.1 36 24 36z"
                />
                <path
                  fill="#EA4335"
                  d="M44.5 20H24v8.5h11.7C34.7 33.1 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.2 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"
                />
              </svg>
              {isImporting ? "Importing..." : "Import from Gmail"}
            </button>
            <button
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors duration-200"
              onClick={handleGmailDisconnect}
              title="Disconnect Gmail"
            >
              Disconnect
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors duration-200"
              onClick={checkGmailStatus}
              title="Refresh Gmail Status"
            >
              ↻
            </button>
          </>
        ) : (
          <>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center transition-colors duration-200"
              onClick={handleGmailConnect}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
                <path
                  fill="#4285F4"
                  d="M44.5 20H24v8.5h11.7C34.7 33.1 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.2 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"
                />
                <path
                  fill="#34A853"
                  d="M6.3 14.7l7 5.1C15.6 16.1 19.5 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.2 6.2 29.4 4 24 4c-6.6 0-12 5.4-12 12 0 2.1.5 4.1 1.3 5.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M24 44c5.8 0 10.7-1.9 14.3-5.2l-6.6-5.4C29.8 36 24 36 24 36c-5.8 0-10.7-1.9-14.3-5.2l6.6-5.4C18.2 33.1 23.1 36 24 36z"
                />
                <path
                  fill="#EA4335"
                  d="M44.5 20H24v8.5h11.7C34.7 33.1 29.8 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6.1-6.1C34.2 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"
                />
              </svg>
              Connect Gmail
            </button>
            <button
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors duration-200"
              onClick={checkGmailStatus}
              title="Refresh Gmail Status"
            >
              ↻
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Navbar;
