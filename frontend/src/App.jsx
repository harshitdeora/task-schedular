import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DagList from "./pages/DagList";
import DagBuilder from "./pages/DagBuilder";
import ExecutionMonitor from "./pages/ExecutionMonitor";
import ExecutionHistory from "./pages/ExecutionHistory";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dags" element={<DagList />} />
        <Route path="/builder" element={<DagBuilder />} />
        <Route path="/monitor" element={<ExecutionMonitor />} />
        <Route path="/history" element={<ExecutionHistory />} />

        {/* Fallback: redirect any unknown path to the builder (or change to /dags if you prefer) */}
        <Route path="*" element={<Navigate to="/builder" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
