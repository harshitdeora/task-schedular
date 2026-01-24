// src/components/Navbar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar({ user, onLogout }) {
  const location = useLocation();

  const navItemBaseStyle = {
    textDecoration: "none",
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: "14px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    border: "1px solid transparent",
    transition:
      "background-color 0.2s ease-out, color 0.2s ease-out, box-shadow 0.2s ease-out, transform 0.2s ease-out, border-color 0.2s ease-out",
  };

  const makeNavStyle = (active) => ({
    ...navItemBaseStyle,
    color: active ? "#e5e7eb" : "#9ca3af",
    background: active
      ? "radial-gradient(circle at top left, rgba(37,99,235,0.85), rgba(15,23,42,0.9))"
      : "rgba(15,23,42,0.7)",
    borderColor: active ? "rgba(129,140,248,0.9)" : "rgba(30,64,175,0.4)",
    boxShadow: active
      ? "0 0 0 1px rgba(59,130,246,0.7), 0 14px 35px rgba(15,23,42,0.9)"
      : "0 10px 30px rgba(15,23,42,0.9)",
  });

  return (
    <nav
      className="navbar"
      style={{
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96))",
        padding: "12px 20px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(31,41,55,0.95)",
        boxShadow: "0 18px 45px rgba(15,23,42,0.98)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <Link
          to="/"
          className="navbar-brand"
          style={{
            color: "#e5e7eb",
            fontSize: "20px",
            fontWeight: 600,
            textDecoration: "none",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              width: 28,
              height: 28,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 30% 0%, rgba(59,130,246,1), rgba(37,99,235,0.1))",
              boxShadow: "0 0 0 1px rgba(59,130,246,0.75)",
            }}
          >
            ⚙️
          </span>
          <span>Task Scheduler</span>
        </Link>

        <div
          className="navbar-nav"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <Link
            to="/"
            className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
            style={makeNavStyle(location.pathname === "/")}
          >
            Dashboard
          </Link>
          <Link
            to="/dags"
            className={`nav-link ${
              location.pathname === "/dags" ? "active" : ""
            }`}
            style={makeNavStyle(location.pathname === "/dags")}
          >
            DAGs
          </Link>
          <Link
            to="/builder"
            className={`nav-link ${
              location.pathname === "/builder" ? "active" : ""
            }`}
            style={makeNavStyle(location.pathname === "/builder")}
          >
            Builder
          </Link>
          <Link
            to="/history"
            className={`nav-link ${
              location.pathname === "/history" ? "active" : ""
            }`}
            style={makeNavStyle(location.pathname === "/history")}
          >
            History
          </Link>
          <Link
            to="/settings"
            className={`nav-link ${
              location.pathname === "/settings" ? "active" : ""
            }`}
            style={makeNavStyle(location.pathname === "/settings")}
          >
            Settings
          </Link>
          {user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginLeft: "18px",
                paddingLeft: "18px",
                borderLeft: "1px solid rgba(55,65,81,0.9)",
              }}
            >
              <span
                style={{
                  color: "#9ca3af",
                  fontSize: "13px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {user.name}
              </span>
              <button
                onClick={onLogout}
                className="custom-border-btn"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.9)",
                  border: "1px solid rgba(148,163,184,0.6)",
                  color: "#e5e7eb",
                  boxShadow: "0 10px 30px rgba(15,23,42,0.9)",
                  transition:
                    "background-color 0.2s ease-out, box-shadow 0.2s ease-out, transform 0.2s ease-out, border-color 0.2s ease-out",
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
