export const BASE_URL = "https://389ad59ceb52.ngrok-free.app";

// utils/apiPaths.js
export const API_PATHS = {
  AUTH: {
    LOGIN: "/api/v1/auth/login",
    REGISTER: "/api/v1/auth/register",
    GET_USER_INFO: "/api/v1/auth/getUser",
  },
  DASHBOARD: {
    GET_DATA: "/api/v1/dashboard",
  },
  INCOME: {
    ADD_INCOME: "/api/v1/income/add",
    GET_ALL_INCOME: "/api/v1/income/get",
    DELETE_INCOME: (incomeId) => `/api/v1/income/${incomeId}`,
    DOWNLOAD_INCOME: `/api/v1/income/downloadexcel`,
  },
  EXPENSE: {
    ADD_EXPENSE: "/api/v1/expense/add",
    GET_ALL_EXPENSES: "/api/v1/expense/get",
    DELETE_EXPENSE: (expenseId) => `/api/v1/expense/${expenseId}`,
    DOWNLOAD_EXPENSE: `/api/v1/expense/downloadexcel`,
  },
  IMAGE: {
    UPLOAD_IMAGE: "/api/v1/auth/upload-image",
  },
  GMAIL: {
    GMAIL_PARSER: "/api/gmail/fetch-expenses",
    IMPORT_STATUS: "/api/gmail/import-status",
    PROCESSED_EMAILS: "/api/gmail/processed-emails",
    CLEAR_PROCESSED_EMAILS: "/api/gmail/clear-processed-emails",
    // Gmail Authentication
    AUTH_URL: "/api/gmail/auth/url",
    AUTH_STATUS: "/api/gmail/auth/status",
    AUTH_DISCONNECT: "/api/gmail/auth/disconnect",
    AUTH_TEST: "/api/gmail/auth/test",
  },
};
