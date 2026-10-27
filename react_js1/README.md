# React + Node.js + MySQL Authentication

A simple Login and Sign Up app with MySQL database storage and unique JWT token generation.

## Features
- Login & Sign Up with password validation
- Saves users to MySQL database (`login_signup`)
- Generates a unique JWT token for every session
- Token stored in browser `localStorage` and DevTools Console (hidden from UI)

## How to Run

### 1. Install dependencies
```bash
npm install
```

### 2. Start MySQL
Make sure your local MySQL service is running:
```bash
sudo service mysql start
```

### 3. Start Backend Server
```bash
node server.js
```
*Backend runs on `http://127.0.0.1:5000`*

### 4. Start Frontend
In a new terminal:
```bash
npm run dev
```
*Frontend runs on `http://localhost:5173`*
