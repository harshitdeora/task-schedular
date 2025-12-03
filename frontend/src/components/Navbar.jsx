// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const navStyle = {
    background: "#222",
    color: "#fff",
    padding: "10px 16px",
  };
  const linkStyle = {
    color: "#fff",
    textDecoration: "underline",
    marginRight: 16,
  };

  return (
    <nav style={navStyle}>
      {/* Use <Link> so routing is client-side and does not reload the page */}
      <Link to="/" style={linkStyle}>Dashboard</Link>
      <Link to="/dags" style={linkStyle}>DAGsBuilder</Link>
      <Link to="/builder" style={linkStyle}>Builder</Link>
      <Link to="/monitor" style={{ color: "white", marginRight: "1rem" }}>Monitor</Link>
      <Link to="/history" style={{ color: "white" }}>History</Link>

    </nav>
  );
}
