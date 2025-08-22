import React, { useState } from "react";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";
import SideMenu from "./SideMenu";
import { API_PATHS } from "../../utils/apiPaths";
import axois from "axios";
import axiosInstance from "../../utils/axiosInstance";
const Navbar = ({ activeMenu }) => {
  const [openSideMenu, setOpenSideMenu] = useState(false);
  const handleGmailLogin = async () => {
    try {
      // Optionally, open a popup for OAuth2 if needed
      // For now, just call your backend endpoint
      const res = await axois.get(
        "http://localhost:8000/api/gmail/fetch-expenses"
      );
      const data = res.data; // axios already parses JSON
      console.log(data);

      // Show a toast or update your expenses list
      console.log(data);
      // Optionally, update your UI with the imported expenses
    } catch (err) {
      alert("Failed to import from Gmail");
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

      {/* Example: Add this near your existing Add button */}
      <button
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded ml-2 flex items-center"
        onClick={handleGmailLogin}
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
        Import from Gmail
      </button>
    </div>
  );
};

export default Navbar;
