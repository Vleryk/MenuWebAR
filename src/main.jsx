import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import AdminDashboard from "./admin/AdminDashboard";
import "./globals.css";
import DirectARViewer from "./components/DirectARViewer"; 

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/ar/:itemId" element={<DirectARViewer />} /> 
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
