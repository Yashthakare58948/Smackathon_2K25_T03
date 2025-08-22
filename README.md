# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
Here’s your README updated with **all URLs pointing to your GitHub and project repository**:

````markdown
# 💸 SpendWise: Expense Tracker

SpendWise is a full-stack Expense Tracker app to manage your income and expenses efficiently. Built with **React (Vite)** on the frontend, **Node.js (Express)** for the backend, and **MongoDB** for data storage.

---

## 📦 Features

- 🔐 User authentication with JWT
- 💰 Add, update, and delete income/expenses
- 📊 Graphs and charts for insights (Bar/Pie)
- 📆 Filter transactions by date
- 🔎 View recent transactions
- 📁 Download income/expense data in Excel

---

## 🧑‍💻 Tech Stack

### Frontend ⚛️

- React + Vite
- Tailwind CSS
- Recharts
- Axios

### Backend 🛠️

- Node.js + Express
- MongoDB + Mongoose
- JWT (Authentication)
- dotenv

---

## 📁 Folder Structure

SpendWise/

- ├── backend/ → Node.js Express API
- ├── frontend/expense-tracker/ → Vite + React frontend

---

## 🛠️ Setup Instructions

### 1. Clone the repository

```bash
git https://github.com/Yashthakare58948/Smackathon_2K25_T03
cd FinWell
```
````

### 2. Backend setup

```bash
cd backend
npm install
```

- Create a `.env` file inside `/backend`:

```.env
MONGO_URI=your_mongo_connection_string
JWT_SECRET=your_jwt_secret
PORT=8000
```

- Run the backend server

```bash
npm run dev
```

### 3. Frontend setup

```bash
cd frontend/expense-tracker
npm install
```

- Create a `.env` file inside `/frontend/expense-tracker`:

```env
VITE_BASE_URL=http://localhost:8000
```

- Run the frontend

```bash
npm run dev
```

---

## 🙌 Acknowledgements

- Inspired by modern personal finance tools
- Built using best practices in the MERN stack

---

## 🧑‍💼 Author

- Yash Thakare
- 📫 [GitHub](https://github.com/Yashthakare58948)

```

All repository links now point to your GitHub (`Yashthakare58948/FinWell`).

If you want, I can also **update the project name inside the README** from `Expense-Tracker` to `SpendWise` everywhere for consistency. Do you want me to do that?
```

