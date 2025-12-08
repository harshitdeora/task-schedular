// src/components/Navbar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar({ user, onLogout }) {
  const location = useLocation();

  return (
    <nav className="navbar" style={{ 
      background: "linear-gradient(15deg, #13547a 0%, #80d0c7 100%)",
      padding: "15px 20px",
      position: "sticky",
      top: 0,
      zIndex: 1000
    }}>
      <div className="container" style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <Link to="/" className="navbar-brand" style={{ 
          color: "#fff", 
          fontSize: "24px", 
          fontWeight: "bold",
          textDecoration: "none"
        }}>
          Task Scheduler
        </Link>
        
        <div className="navbar-nav" style={{ display: "flex", gap: "10px" }}>
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
            style={{ 
              color: location.pathname === "/" ? "#13547a" : "#fff",
              textDecoration: "none",
              padding: "10px 15px",
              borderRadius: "20px",
              transition: "all 0.3s"
            }}
          >
            Dashboard
          </Link>
          <Link 
            to="/dags" 
            className={`nav-link ${location.pathname === "/dags" ? "active" : ""}`}
            style={{ 
              color: location.pathname === "/dags" ? "#13547a" : "#fff",
              textDecoration: "none",
              padding: "10px 15px",
              borderRadius: "20px",
              transition: "all 0.3s"
            }}
          >
            DAGs
          </Link>
          <Link 
            to="/builder" 
            className={`nav-link ${location.pathname === "/builder" ? "active" : ""}`}
            style={{ 
              color: location.pathname === "/builder" ? "#13547a" : "#fff",
              textDecoration: "none",
              padding: "10px 15px",
              borderRadius: "20px",
              transition: "all 0.3s"
            }}
          >
            Builder
          </Link>
          <Link 
            to="/history" 
            className={`nav-link ${location.pathname === "/history" ? "active" : ""}`}
            style={{ 
              color: location.pathname === "/history" ? "#13547a" : "#fff",
              textDecoration: "none",
              padding: "10px 15px",
              borderRadius: "20px",
              transition: "all 0.3s"
            }}
          >
            History
          </Link>
          <Link 
            to="/settings" 
            className={`nav-link ${location.pathname === "/settings" ? "active" : ""}`}
            style={{ 
              color: location.pathname === "/settings" ? "#13547a" : "#fff",
              textDecoration: "none",
              padding: "10px 15px",
              borderRadius: "20px",
              transition: "all 0.3s"
            }}
          >
            Settings
          </Link>
          {user && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "15px",
              marginLeft: "20px",
              paddingLeft: "20px",
              borderLeft: "1px solid rgba(255,255,255,0.3)"
            }}>
              <span style={{ color: "#fff", fontSize: "14px" }}>
                {user.name}
              </span>
              <button
                onClick={onLogout}
                className="custom-border-btn"
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  color: "#fff"
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
