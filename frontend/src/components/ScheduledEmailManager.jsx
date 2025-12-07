import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ScheduledEmailManager({ user }) {
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    recipient: "",
    subject: "",
    message: "",
    scheduledDateTime: ""
  });

  useEffect(() => {
    if (user) {
      fetchScheduledEmails();
    }
  }, [user]);

  const fetchScheduledEmails = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/scheduled-emails`, {
        withCredentials: true
      });
      if (response.data.success) {
        setScheduledEmails(response.data.scheduledEmails);
      }
    } catch (error) {
      console.error("Error fetching scheduled emails:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/scheduled-emails`,
        formData,
        { withCredentials: true }
      );

      if (response.data.success) {
        alert("✅ Scheduled email created successfully!");
        setFormData({ recipient: "", subject: "", message: "", scheduledDateTime: "" });
        setShowForm(false);
        fetchScheduledEmails();
      }
    } catch (error) {
      console.error("Error creating scheduled email:", error);
      alert("Failed to create scheduled email: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to cancel this scheduled email?")) return;

    try {
      const response = await axios.delete(
        `${API_URL}/api/scheduled-emails/${id}`,
        { withCredentials: true }
      );

      if (response.data.success) {
        alert("✅ Scheduled email cancelled");
        fetchScheduledEmails();
      }
    } catch (error) {
      console.error("Error deleting scheduled email:", error);
      alert("Failed to cancel scheduled email: " + (error.response?.data?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "#ff9800";
      case "sent": return "#4caf50";
      case "failed": return "#f44336";
      case "cancelled": return "#9e9e9e";
      default: return "#666";
    }
  };

  return (
    <div style={{ marginTop: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ color: "#13547a", margin: 0 }}>📧 Scheduled Emails</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="custom-btn"
          style={{ padding: "8px 20px" }}
        >
          {showForm ? "Cancel" : "+ New Scheduled Email"}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: "#f0f8ff",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "20px",
          border: "2px solid #80d0c7"
        }}>
          <h4 style={{ color: "#13547a", marginTop: 0 }}>Create Scheduled Email</h4>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                Recipient Email *
              </label>
              <input
                type="email"
                required
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                placeholder="recipient@example.com"
                className="custom-form form-control"
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                Subject *
              </label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject"
                className="custom-form form-control"
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                Message *
              </label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Email message"
                className="custom-form form-control"
                rows="5"
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#13547a", fontWeight: "600" }}>
                Schedule Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.scheduledDateTime}
                onChange={(e) => setFormData({ ...formData, scheduledDateTime: e.target.value })}
                className="custom-form form-control"
                min={new Date().toISOString().slice(0, 16)}
              />
              <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "5px" }}>
                📧 Email will be sent from: <strong>{user?.email}</strong> (your logged-in email)
              </small>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="custom-btn"
              style={{ width: "100%", padding: "12px" }}
            >
              {loading ? "Creating..." : "Schedule Email"}
            </button>
          </form>
        </div>
      )}

      <div style={{ background: "white", borderRadius: "10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        {scheduledEmails.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>
            No scheduled emails yet. Create one above!
          </p>
        ) : (
          <div style={{ display: "grid", gap: "15px" }}>
            {scheduledEmails.map((email) => (
              <div
                key={email.id}
                style={{
                  padding: "15px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  background: "#fafafa"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                      <strong style={{ color: "#13547a" }}>{email.subject}</strong>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          background: getStatusColor(email.status),
                          color: "white",
                          fontWeight: "600"
                        }}
                      >
                        {email.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#666", marginBottom: "5px" }}>
                      <strong>To:</strong> {email.recipient}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666", marginBottom: "5px" }}>
                      <strong>Scheduled:</strong> {new Date(email.scheduledDateTime).toLocaleString()}
                    </div>
                    {email.sentAt && (
                      <div style={{ fontSize: "13px", color: "#666" }}>
                        <strong>Sent:</strong> {new Date(email.sentAt).toLocaleString()}
                      </div>
                    )}
                    {email.errorMessage && (
                      <div style={{ fontSize: "12px", color: "#f44336", marginTop: "5px" }}>
                        <strong>Error:</strong> {email.errorMessage}
                      </div>
                    )}
                  </div>
                  {email.status === "pending" && (
                    <button
                      onClick={() => handleDelete(email.id)}
                      className="custom-border-btn"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <div style={{ fontSize: "13px", color: "#666", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #e0e0e0" }}>
                  {email.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

