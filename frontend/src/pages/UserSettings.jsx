import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function UserSettings({ user }) {
  const [smtpSettings, setSmtpSettings] = useState({
    host: "",
    port: 587,
    secure: false,
    user: user?.email || "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [hasExistingSettings, setHasExistingSettings] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Reset state when user changes
    setSmtpSettings({
      host: "",
      port: 587,
      secure: false,
      user: user?.email || "",
      password: ""
    });
    setHasExistingSettings(false);
    setMessage("");
    
    if (user) {
      fetchSmtpSettings();
    }
  }, [user?.id, user?.email]); // Re-run when user ID or email changes

  const fetchSmtpSettings = async () => {
    if (!user || !user.id) {
      // Reset if no user
      setSmtpSettings({
        host: "",
        port: 587,
        secure: false,
        user: "",
        password: ""
      });
      setHasExistingSettings(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/api/user/smtp`, {
        withCredentials: true
      });
      if (response.data.success) {
        const settings = response.data.smtpSettings || {};
        setSmtpSettings({
          host: settings.host || "",
          port: settings.port || 587,
          secure: settings.secure || false,
          user: settings.user || user?.email || "",
          password: "" // Don't show existing password
        });
        setHasExistingSettings(!!settings.host && !!settings.user);
      } else {
        // No settings found, reset to defaults with current user's email
        setSmtpSettings({
          host: "",
          port: 587,
          secure: false,
          user: user?.email || "",
          password: ""
        });
        setHasExistingSettings(false);
      }
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      // On error, reset to defaults with current user's email
      setSmtpSettings({
        host: "",
        port: 587,
        secure: false,
        user: user?.email || "",
        password: ""
      });
      setHasExistingSettings(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // If updating existing settings and password is empty, don't send password
      const settingsToSend = { ...smtpSettings };
      if (hasExistingSettings && (!settingsToSend.password || settingsToSend.password.trim() === "")) {
        // Don't include password if updating and not provided
        delete settingsToSend.password;
      }

      // Validate required fields
      if (!settingsToSend.host || !settingsToSend.user) {
        setMessage("❌ Host and Username are required");
        setLoading(false);
        return;
      }

      // If no existing settings, password is required
      if (!hasExistingSettings && (!settingsToSend.password || settingsToSend.password.trim() === "")) {
        setMessage("❌ Password is required for new SMTP settings");
        setLoading(false);
        return;
      }

      const response = await axios.put(
        `${API_URL}/api/user/smtp`,
        settingsToSend,
        { withCredentials: true }
      );

      if (response.data.success) {
        setMessage("✅ SMTP settings saved successfully!");
        setHasExistingSettings(true);
        setSmtpSettings({ ...smtpSettings, password: "" }); // Clear password field
        // Refresh settings to get updated info
        await fetchSmtpSettings();
      }
    } catch (error) {
      setMessage("❌ Failed to save: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove your SMTP settings? Emails will use default SMTP configuration.")) {
      return;
    }

    try {
      const response = await axios.delete(`${API_URL}/api/user/smtp`, {
        withCredentials: true
      });

      if (response.data.success) {
        setMessage("✅ SMTP settings removed");
        setHasExistingSettings(false);
        setSmtpSettings({
          host: "",
          port: 587,
          secure: false,
          user: user?.email || "",
          password: ""
        });
      }
    } catch (error) {
      setMessage("❌ Failed to remove: " + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="section-padding">
      <div className="container" style={{ maxWidth: "800px" }}>
        <h1 style={{ marginBottom: "2rem" }}>Email Settings</h1>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#13547a", marginBottom: "15px" }}>📧 SMTP Configuration (Optional)</h3>
          <div style={{ 
            padding: "15px", 
            background: "#fff3cd", 
            borderRadius: "8px", 
            marginBottom: "20px",
            border: "1px solid #ffc107"
          }}>
            <p style={{ color: "#856404", margin: 0, fontSize: "14px", fontWeight: "500" }}>
              <strong>⚠️ Required for Email Tasks:</strong> You <strong>must</strong> configure SMTP settings to send emails.
            </p>
            <ul style={{ color: "#856404", margin: "10px 0 0 20px", fontSize: "13px", lineHeight: "1.6" }}>
              <li><strong>Email tasks require:</strong> Your SMTP host, port, username, and app password</li>
              <li><strong>Emails will be sent:</strong> From YOUR email address using YOUR SMTP credentials</li>
              <li><strong>For Gmail:</strong> Use App Password (not your regular password) - see guide below</li>
            </ul>
          </div>
          <p style={{ color: "#666", marginBottom: "20px", fontSize: "14px" }}>
            Configure your SMTP settings to enable email sending in your DAGs. 
            <strong> This is required</strong> - email tasks will fail without SMTP configuration.
          </p>

          {message && (
            <div style={{
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
              background: message.includes("✅") ? "#d4edda" : "#f8d7da",
              color: message.includes("✅") ? "#155724" : "#721c24"
            }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                SMTP Host *
              </label>
              <input
                type="text"
                required
                value={smtpSettings.host}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                placeholder="smtp.gmail.com or smtp.sendgrid.net"
                className="custom-form form-control"
              />
              <small style={{ fontSize: "12px", color: "#666" }}>
                Examples: smtp.gmail.com, smtp.sendgrid.net, smtp.mailgun.org
              </small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                SMTP Port *
              </label>
              <input
                type="number"
                required
                value={smtpSettings.port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) })}
                placeholder="587"
                className="custom-form form-control"
              />
              <small style={{ fontSize: "12px", color: "#666" }}>
                Common ports: 587 (TLS), 465 (SSL), 2525 (Mailtrap)
              </small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={smtpSettings.secure}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                  style={{ marginRight: "8px", width: "18px", height: "18px" }}
                />
                <span style={{ color: "#13547a", fontWeight: "600" }}>Use SSL/TLS (secure)</span>
              </label>
              <small style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "5px" }}>
                Enable for port 465 (SSL), disable for port 587 (TLS)
              </small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                SMTP Username/Email *
              </label>
              <input
                type="text"
                required
                value={smtpSettings.user}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                placeholder={user?.email || "your-email@example.com"}
                className="custom-form form-control"
              />
              <small style={{ fontSize: "12px", color: "#666" }}>
                Your email address or SMTP username
              </small>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                SMTP Password *
              </label>
              <input
                type="password"
                required={!hasExistingSettings}
                value={smtpSettings.password}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                placeholder={hasExistingSettings ? "Enter new password to update" : "Your SMTP password"}
                className="custom-form form-control"
              />
              <small style={{ fontSize: "12px", color: "#666" }}>
                {hasExistingSettings 
                  ? "Leave empty to keep existing password, or enter new password to update"
                  : "For Gmail: Use App Password (not regular password)"}
              </small>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={loading}
                className="custom-btn"
                style={{ padding: "12px 24px" }}
              >
                {loading ? "Saving..." : hasExistingSettings ? "Update Settings" : "Save Settings"}
              </button>
              {hasExistingSettings && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="custom-border-btn"
                  style={{ padding: "12px 24px", borderColor: "#ef4444", color: "#ef4444" }}
                >
                  Remove Settings (Use Default)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  // Clear form and show that default will be used
                  setSmtpSettings({
                    host: "",
                    port: 587,
                    secure: false,
                    user: user?.email || "",
                    password: ""
                  });
                  setMessage("ℹ️ Form cleared. If you don't save settings, default SMTP from server will be used.");
                }}
                className="custom-border-btn"
                style={{ padding: "12px 24px" }}
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>

        <div className="card" style={{ background: "#f0f8ff" }}>
          <h4 style={{ color: "#13547a", marginBottom: "10px" }}>💡 Quick Setup Guides</h4>
          <div style={{ fontSize: "14px", color: "#666" }}>
            <p><strong>Gmail:</strong></p>
            <ul style={{ marginLeft: "20px", marginBottom: "15px" }}>
              <li>Host: smtp.gmail.com</li>
              <li>Port: 587</li>
              <li>Secure: No (TLS)</li>
              <li>Username: your-email@gmail.com</li>
              <li>Password: App Password (generate from Google Account → Security → App Passwords)</li>
            </ul>

            <p><strong>SendGrid:</strong></p>
            <ul style={{ marginLeft: "20px", marginBottom: "15px" }}>
              <li>Host: smtp.sendgrid.net</li>
              <li>Port: 587</li>
              <li>Secure: No</li>
              <li>Username: apikey</li>
              <li>Password: Your SendGrid API Key</li>
            </ul>

            <p><strong>Mailtrap (Testing):</strong></p>
            <ul style={{ marginLeft: "20px" }}>
              <li>Host: sandbox.smtp.mailtrap.io</li>
              <li>Port: 2525</li>
              <li>Secure: No</li>
              <li>Get credentials from mailtrap.io</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

