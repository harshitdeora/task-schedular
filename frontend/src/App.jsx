// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DagList from "./pages/DagList";
import DagBuilder from "./pages/DagBuilder";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dags" element={<DagList />} />
        <Route path="/builder" element={<DagBuilder />} />

        {/* Fallback: redirect any unknown path to the builder (or change to /dags if you prefer) */}
        <Route path="*" element={<Navigate to="/builder" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
