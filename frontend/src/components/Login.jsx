/**
 * Login Component
 * 
 * Provides user authentication (login/register) functionality.
 * Uses existing backend auth API endpoints and session management.
 * 
 * Features:
 * - Login with username/email and password
 * - User registration
 * - Error handling with clear messages
 * - Session-based authentication (via cookies)
 * - Redirects to dashboard on successful login
 * 
 * Files changed:
 * - frontend/src/components/Login.jsx (enhanced UI to match project style)
 */
import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    name: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Handle form submission for both login and registration
   * Connects to existing backend auth endpoints:
   * - POST /api/auth/login
   * - POST /api/auth/register
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        // Try to login with email and password
        try {
          const response = await axios.post(
            `${API_URL}/api/auth/login`,
            {
              email: formData.username, // Use username field for email in login
              password: formData.password
            },
            { withCredentials: true }
          );

          if (response.data.success) {
            // Force a hard reload with cache busting to ensure fresh session and user data
            window.location.replace(`/?_t=${Date.now()}`);
            return;
          }
        } catch (loginError) {
          // If user doesn't exist, redirect to register mode
          if (loginError.response?.data?.needsRegistration) {
            setError("User not found. Please register first.");
            setIsLogin(false);
            // Pre-fill email in register form
            setFormData({
              ...formData,
              email: formData.username,
              username: formData.username.split("@")[0] || formData.username // Generate username from email
            });
            setLoading(false);
            return;
          }
          throw loginError; // Re-throw other errors
        }
      } else {
        // Registration
        const response = await axios.post(
          `${API_URL}/api/auth/register`,
          formData,
          { withCredentials: true }
        );

        if (response.data.success) {
          // After registration, automatically login
          window.location.replace(`/?_t=${Date.now()}`);
        }
      }
    } catch (error) {
      // Display error message from backend or generic error
      setError(error.response?.data?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle between login and register modes
   */
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({ username: "", email: "", password: "", name: "" });
  };

  return (
    <div className="section-padding" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(15deg, #13547a 0%, #80d0c7 100%)"
    }}>
      <div className="container" style={{ maxWidth: "500px" }}>
        <div className="card" style={{ padding: "3rem" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h1 style={{ 
              color: "var(--primary-color)", 
              marginBottom: "0.5rem",
              fontSize: "var(--h3-font-size)"
            }}>
              {isLogin ? "Login" : "Create Account"}
            </h1>
            <p style={{ color: "var(--p-color)", fontSize: "var(--p-font-size)" }}>
              {isLogin 
                ? "Sign in to access your Task Scheduler" 
                : "Register to start scheduling tasks"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alert-danger" style={{
              backgroundColor: "#ffebee",
              color: "#c62828",
              padding: "1rem",
              borderRadius: "var(--border-radius-small)",
              marginBottom: "1.5rem",
              fontSize: "14px",
              border: "1px solid #ffcdd2"
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="custom-form">
            {/* Full Name (Registration only) */}
            {!isLogin && (
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label htmlFor="name" style={{ 
                  display: "block", 
                  marginBottom: "0.5rem", 
                  color: "var(--primary-color)", 
                  fontWeight: "var(--font-weight-semibold)" 
                }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="form-control"
                  disabled={loading}
                />
              </div>
            )}

            {/* Email (Registration only) */}
            {!isLogin && (
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label htmlFor="email" style={{ 
                  display: "block", 
                  marginBottom: "0.5rem", 
                  color: "var(--primary-color)", 
                  fontWeight: "var(--font-weight-semibold)" 
                }}>
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  className="form-control"
                  disabled={loading}
                />
              </div>
            )}

            {/* Email (Login) / Username (Register) */}
            {isLogin ? (
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label htmlFor="email" style={{ 
                  display: "block", 
                  marginBottom: "0.5rem", 
                  color: "var(--primary-color)", 
                  fontWeight: "var(--font-weight-semibold)" 
                }}>
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter your email"
                  className="form-control"
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label htmlFor="username" style={{ 
                  display: "block", 
                  marginBottom: "0.5rem", 
                  color: "var(--primary-color)", 
                  fontWeight: "var(--font-weight-semibold)" 
                }}>
                  Username *
                </label>
                <input
                  type="text"
                  id="username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Choose a username"
                  className="form-control"
                  disabled={loading}
                />
              </div>
            )}

            {/* Password */}
            <div className="form-group" style={{ marginBottom: "2rem" }}>
              <label htmlFor="password" style={{ 
                display: "block", 
                marginBottom: "0.5rem", 
                color: "var(--primary-color)", 
                fontWeight: "var(--font-weight-semibold)" 
              }}>
                Password *
              </label>
              <input
                type="password"
                id="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                className="form-control"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="custom-btn"
              style={{ 
                width: "100%", 
                padding: "12px 24px",
                fontSize: "var(--btn-font-size)"
              }}
            >
              {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <p style={{ color: "var(--p-color)", marginBottom: "0.5rem" }}>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </p>
            <button
              type="button"
              onClick={toggleMode}
              className="custom-border-btn"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary-color)",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "var(--menu-font-size)",
                padding: "0.5rem"
              }}
              disabled={loading}
            >
              {isLogin ? "Register here" : "Login here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
