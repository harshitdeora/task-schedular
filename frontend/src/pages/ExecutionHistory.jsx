import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getExecutions, retryExecution, deleteExecution, deleteAllExecutions, forceCancelExecution } from "../api/executionApi";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b"];
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedExecution, setExpandedExecution] = useState(null);
  const navigate = useNavigate();

  // Check authentication before fetching
  useEffect(() => {
    checkAuthAndFetch();
    const interval = setInterval(checkAuthAndFetch, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const checkAuthAndFetch = async () => {
    try {
      // First verify user is authenticated
      const authCheck = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true
      });
      
      if (!authCheck.data.success) {
        // Not authenticated, redirect to login
        navigate("/login");
        return;
      }
      
      // User is authenticated, fetch executions
      await fetchExecutions();
    } catch (error) {
      // Auth check failed, redirect to login
      console.error("Authentication check failed:", error);
      navigate("/login");
    }
  };

  const deriveStatus = (exec) => {
    // Prefer server-side computed status, fallback to raw status
    const baseStatus = exec.computedStatus || exec.status || "pending";

    // Normalize status values
    if (baseStatus === "success") return "success";
    if (baseStatus === "failed") return "failed";
    if (baseStatus === "cancelled") return "cancelled";
    // Treat queued, running, started, scheduled, retrying, and any other state as pending
    return "pending";
  };

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      // Backend only supports filtering by persisted status; for "pending" we fetch all
      const params = filter !== "all" && filter !== "pending" ? { status: filter } : {};
      const res = await getExecutions(params);
      let data = res.data || [];

      // Filter for pending status on client side if needed
      if (filter === "pending") {
        data = data.filter((exec) => deriveStatus(exec) === "pending");
      }

      setExecutions(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching executions:", error);
      console.error("Error details:", error.response?.data);
      setLoading(false);
      
      // If authentication error, redirect to login silently
      if (error.response?.status === 401 || error.response?.data?.error === "Authentication required") {
        // Don't show alert, just redirect
        navigate("/login");
        return;
      }
      
      // Show error message to user for other errors
      console.error("Failed to load executions: " + (error.response?.data?.error || error.message));
      setExecutions([]); // Clear executions on error
    }
  };

  const handleRetry = async (id) => {
    try {
      await retryExecution(id);
      alert("Execution retried!");
      fetchExecutions();
    } catch (error) {
      alert("Error retrying execution: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this execution?")) return;
    
    try {
      await deleteExecution(id);
      alert("Execution deleted successfully!");
      fetchExecutions();
    } catch (error) {
      alert("Error deleting execution: " + (error.response?.data?.message || error.message));
    }
  };

  const handleForceCancel = async (id) => {
    if (!window.confirm("Force fail this execution?")) return;
    try {
      await forceCancelExecution(id);
      alert("Execution force-failed.");
      fetchExecutions();
    } catch (error) {
      alert("Error force-failing execution: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL execution history? This cannot be undone.")) return;
    
    try {
      const response = await deleteAllExecutions();
      alert(`Successfully deleted ${response.data.deletedCount || 0} execution(s)!`);
      fetchExecutions();
    } catch (error) {
      alert("Error deleting executions: " + (error.response?.data?.message || error.message));
    }
  };

  const statusCounts = executions.reduce((acc, exec) => {
    const status = deriveStatus(exec);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Filter out zero values and ensure proper order
  const pieData = [
    { name: "Success", value: statusCounts.success || 0 },
    { name: "Failed", value: statusCounts.failed || 0 },
    { name: "Pending", value: statusCounts.pending || 0 },
    { name: "Cancelled", value: statusCounts.cancelled || 0 }
  ].filter(item => item.value > 0); // Only show slices with data

  // Prepare timeline data (last 7 days)
  const timelineData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayExecutions = executions.filter(e => {
      const execDate = new Date(e.timeline?.queuedAt || e.createdAt);
      return execDate.toDateString() === date.toDateString();
    });
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      success: dayExecutions.filter(e => deriveStatus(e) === "success").length,
      failed: dayExecutions.filter(e => deriveStatus(e) === "failed").length
    };
  });

  const statusColors = {
    success: "#10b981",
    failed: "#ef4444",
    pending: "#f59e0b",
    running: "#3b82f6",
    queued: "#f59e0b",
    cancelled: "#6b7280"
  };

  return (
    <div className="section-padding">
      <div className="container">
        <h1 style={{ marginBottom: "2rem" }}>Execution History</h1>

        {/* Filter */}
        <div style={{ marginBottom: "2rem", display: "flex", gap: "10px" }}>
          {["all", "pending", "success", "failed"].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={filter === status ? "custom-btn" : "custom-border-btn"}
              style={{ textTransform: "capitalize" }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Charts */}
        {executions.length > 0 && (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
            gap: "20px",
            marginBottom: "3rem"
          }}>
            <div className="card">
              <h3 style={{ marginBottom: "20px" }}>Status Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => {
                        // Map status names to colors
                        const colorMap = {
                          "Success": "#10b981",
                          "Failed": "#ef4444",
                          "Pending": "#f59e0b",
                          "Cancelled": "#6b7280"
                        };
                        return (
                          <Cell key={`cell-${index}`} fill={colorMap[entry.name] || COLORS[index % COLORS.length]} />
                        );
                      })}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ textAlign: "center", color: "#6b7280", padding: "50px" }}>No status data available</p>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: "20px" }}>Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="success" stroke="#10b981" name="Success" strokeWidth={2} />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Executions Table */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0 }}>All Executions</h3>
            {executions.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="custom-border-btn"
                style={{ 
                  padding: "8px 16px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none"
                }}
              >
                Delete All History
              </button>
            )}
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : executions.length === 0 ? (
            <p>No executions found</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>DAG Name</th>
                    <th>Status</th>
                    <th>Current Task</th>
                    <th>Queued At</th>
                    <th>Started At</th>
                    <th>Completed At</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((exec) => {
                    const displayStatus = deriveStatus(exec);
                    let duration = "N/A";
                    if (exec.timeline?.startedAt && exec.timeline?.completedAt) {
                      duration = `${Math.round((new Date(exec.timeline.completedAt) - new Date(exec.timeline.startedAt)) / 1000)}s`;
                    } else if (exec.timeline?.startedAt) {
                      if (displayStatus === "success" || displayStatus === "failed") {
                        // Completed but missing completedAt - calculate from startedAt to now
                        duration = `${Math.round((new Date() - new Date(exec.timeline.startedAt)) / 1000)}s`;
                      } else {
                        duration = "Running...";
                      }
                    } else if (exec.status === "queued") {
                      duration = "Queued...";
                    }

                    // Handle different possible structures of dagId
                    let dagName = "N/A";
                    if (exec.dagId) {
                      if (typeof exec.dagId === 'object') {
                        if (exec.dagId.name) {
                          // DAG exists and has a name
                          dagName = exec.dagId.name;
                        } else if (exec.dagId.deleted === true || exec.dagId._id) {
                          // DAG was deleted (has _id but no name, or explicitly marked as deleted)
                          dagName = "Deleted DAG";
                        }
                      } else if (typeof exec.dagId === 'string') {
                        dagName = exec.dagId;
                      }
                    }
                    
                    // Find currently running task
                    const runningTask = exec.tasks?.find(t => 
                      t.status === "running" || t.status === "started"
                    );
                    const currentTaskName = runningTask ? runningTask.name : 
                      (displayStatus === "pending" || displayStatus === "running" ? "Processing..." : "N/A");
                    
                    return (
                      <React.Fragment key={exec._id}>
                        <tr>
                          <td>{dagName}</td>
                          <td>
                            <span
                              style={{
                                padding: "4px 12px",
                                borderRadius: "12px",
                                backgroundColor: statusColors[displayStatus] || statusColors[exec.status] || "#6b7280",
                                color: "white",
                                fontSize: "12px",
                                fontWeight: "500",
                                textTransform: "capitalize"
                              }}
                            >
                              {displayStatus}
                            </span>
                          </td>
                          <td>
                            {runningTask ? (
                              <span style={{
                                padding: "4px 12px",
                                borderRadius: "12px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                fontSize: "12px",
                                fontWeight: "500"
                              }}>
                                ▶ {currentTaskName}
                              </span>
                            ) : (
                              <span style={{ color: "#666", fontSize: "12px" }}>{currentTaskName}</span>
                            )}
                          </td>
                          <td>{exec.timeline?.queuedAt ? new Date(exec.timeline.queuedAt).toLocaleString() : "N/A"}</td>
                          <td>
                            {exec.timeline?.startedAt 
                              ? new Date(exec.timeline.startedAt).toLocaleString() 
                              : exec.status === "queued" 
                                ? "Queued..." 
                                : "N/A"}
                          </td>
                          <td>
                              {exec.timeline?.completedAt 
                              ? new Date(exec.timeline.completedAt).toLocaleString() 
                              : displayStatus === "success" || displayStatus === "failed"
                                ? "Completed" 
                                : "N/A"}
                          </td>
                          <td>{duration}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <button
                                onClick={() => setExpandedExecution(expandedExecution === exec._id ? null : exec._id)}
                                className="custom-border-btn"
                                style={{ 
                                  padding: "4px 12px", 
                                  fontSize: "12px",
                                  backgroundColor: expandedExecution === exec._id ? "#13547a" : "transparent",
                                  color: expandedExecution === exec._id ? "white" : "#13547a",
                                  border: "1px solid #13547a"
                                }}
                              >
                                {expandedExecution === exec._id ? "▼ Hide" : "▶ View"} Details
                              </button>
                              {displayStatus === "failed" && (
                                <button
                                  onClick={() => handleRetry(exec._id)}
                                  className="custom-btn"
                                  style={{ padding: "4px 12px", fontSize: "12px" }}
                                >
                                  Retry
                                </button>
                              )}
                              {(displayStatus === "success" || displayStatus === "failed" || displayStatus === "cancelled") && (
                                <button
                                  onClick={() => handleDelete(exec._id)}
                                  className="custom-border-btn"
                                  style={{ 
                                    padding: "4px 12px", 
                                    fontSize: "12px",
                                    backgroundColor: "#ef4444",
                                    color: "white",
                                    border: "none"
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                              {(displayStatus === "pending") && (
                                <button
                                  onClick={() => handleForceCancel(exec._id)}
                                  className="custom-border-btn"
                                  style={{
                                    padding: "4px 12px",
                                    fontSize: "12px",
                                    backgroundColor: "#f59e0b",
                                    color: "white",
                                    border: "none"
                                  }}
                                >
                                  Force Fail
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedExecution === exec._id && (
                          <tr>
                            <td colSpan="8" style={{ padding: "20px", backgroundColor: "#f9fafb" }}>
                            <div style={{ marginTop: "10px" }}>
                              <h4 style={{ marginBottom: "15px", color: "#13547a" }}>Task Details</h4>
                              {exec.tasks && exec.tasks.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                  {exec.tasks.map((task, idx) => (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        border: "1px solid #e5e7eb", 
                                        borderRadius: "8px", 
                                        padding: "15px",
                                        backgroundColor: "white"
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <div>
                                          <strong style={{ fontSize: "16px" }}>{task.name || `Task ${idx + 1}`}</strong>
                                          <span
                                            style={{
                                              marginLeft: "10px",
                                              padding: "4px 12px",
                                              borderRadius: "12px",
                                              backgroundColor: statusColors[task.status] || "#6b7280",
                                              color: "white",
                                              fontSize: "12px",
                                              fontWeight: "500"
                                            }}
                                          >
                                            {task.status}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#666" }}>
                                          {task.startedAt && `Started: ${new Date(task.startedAt).toLocaleString()}`}
                                          {task.completedAt && ` | Completed: ${new Date(task.completedAt).toLocaleString()}`}
                                        </div>
                                      </div>
                                      
                                      {task.error && (
                                        <div style={{ 
                                          padding: "10px", 
                                          backgroundColor: "#fee2e2", 
                                          borderRadius: "6px", 
                                          marginBottom: "10px",
                                          border: "1px solid #fecaca"
                                        }}>
                                          <strong style={{ color: "#dc2626" }}>Error:</strong>
                                          <pre style={{ 
                                            marginTop: "5px", 
                                            fontSize: "12px", 
                                            color: "#991b1b",
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word"
                                          }}>
                                            {typeof task.error === "string" ? task.error : JSON.stringify(task.error, null, 2)}
                                          </pre>
                                        </div>
                                      )}

                                      {task.output && (
                                        <div style={{ marginTop: "10px" }}>
                                          <strong style={{ color: "#13547a", fontSize: "14px" }}>Output:</strong>
                                          
                                          {/* HTTP Request Task Output */}
                                          {task.output.statusCode !== undefined || task.output.responseBody !== undefined ? (
                                            <div style={{ 
                                              marginTop: "10px", 
                                              padding: "15px", 
                                              backgroundColor: "#f0f9ff", 
                                              borderRadius: "6px",
                                              border: "1px solid #bae6fd"
                                            }}>
                                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "15px" }}>
                                                <div>
                                                  <strong style={{ color: "#13547a", fontSize: "12px" }}>HTTP Status:</strong>
                                                  <div style={{ 
                                                    marginTop: "5px",
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    backgroundColor: task.output.statusCode >= 200 && task.output.statusCode < 300 ? "#d1fae5" : "#fee2e2",
                                                    color: task.output.statusCode >= 200 && task.output.statusCode < 300 ? "#065f46" : "#991b1b",
                                                    display: "inline-block",
                                                    fontWeight: "bold"
                                                  }}>
                                                    {task.output.statusCode} {task.output.statusText || ""}
                                                  </div>
                                                </div>
                                                {task.output.durationMs !== undefined && (
                                                  <div>
                                                    <strong style={{ color: "#13547a", fontSize: "12px" }}>Duration:</strong>
                                                    <div style={{ marginTop: "5px", fontSize: "14px", color: "#666" }}>
                                                      {task.output.durationMs}ms
                                                    </div>
                                                  </div>
                                                )}
                                                {task.output.success !== undefined && (
                                                  <div>
                                                    <strong style={{ color: "#13547a", fontSize: "12px" }}>Success:</strong>
                                                    <div style={{ 
                                                      marginTop: "5px",
                                                      padding: "4px 8px",
                                                      borderRadius: "6px",
                                                      backgroundColor: task.output.success ? "#d1fae5" : "#fee2e2",
                                                      color: task.output.success ? "#065f46" : "#991b1b",
                                                      display: "inline-block",
                                                      fontSize: "12px",
                                                      fontWeight: "bold"
                                                    }}>
                                                      {task.output.success ? "✓ Yes" : "✗ No"}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>

                                              {task.output.responseBody && (
                                                <div style={{ marginTop: "15px" }}>
                                                  <strong style={{ color: "#13547a", fontSize: "12px", display: "block", marginBottom: "8px" }}>Response Body:</strong>
                                                  <pre style={{ 
                                                    padding: "12px", 
                                                    backgroundColor: "#1e293b", 
                                                    color: "#e2e8f0",
                                                    borderRadius: "6px",
                                                    overflow: "auto",
                                                    fontSize: "12px",
                                                    maxHeight: "400px",
                                                    fontFamily: "'Courier New', monospace"
                                                  }}>
                                                    {typeof task.output.responseBody === "string" 
                                                      ? task.output.responseBody 
                                                      : JSON.stringify(task.output.responseBody, null, 2)}
                                                  </pre>
                                                </div>
                                              )}

                                              {task.output.responseHeaders && Object.keys(task.output.responseHeaders).length > 0 && (
                                                <div style={{ marginTop: "15px" }}>
                                                  <strong style={{ color: "#13547a", fontSize: "12px", display: "block", marginBottom: "8px" }}>Response Headers:</strong>
                                                  <div style={{ 
                                                    padding: "12px", 
                                                    backgroundColor: "#f8fafc", 
                                                    borderRadius: "6px",
                                                    border: "1px solid #e2e8f0"
                                                  }}>
                                                    {Object.entries(task.output.responseHeaders).map(([key, value]) => (
                                                      <div key={key} style={{ 
                                                        display: "flex", 
                                                        padding: "4px 0",
                                                        borderBottom: "1px solid #e2e8f0",
                                                        fontSize: "12px"
                                                      }}>
                                                        <strong style={{ color: "#475569", minWidth: "200px" }}>{key}:</strong>
                                                        <span style={{ color: "#64748b", wordBreak: "break-word" }}>{String(value)}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            /* Generic Output Display */
                                            <div style={{ 
                                              marginTop: "10px", 
                                              padding: "12px", 
                                              backgroundColor: "#f8fafc", 
                                              borderRadius: "6px",
                                              border: "1px solid #e2e8f0"
                                            }}>
                                              <pre style={{ 
                                                margin: 0,
                                                fontSize: "12px",
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-word",
                                                fontFamily: "'Courier New', monospace"
                                              }}>
                                                {typeof task.output === "string" 
                                                  ? task.output 
                                                  : JSON.stringify(task.output, null, 2)}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {task.logs && (
                                        <div style={{ marginTop: "10px" }}>
                                          <strong style={{ color: "#13547a", fontSize: "14px" }}>Logs:</strong>
                                          <pre style={{ 
                                            marginTop: "5px", 
                                            padding: "10px", 
                                            backgroundColor: "#f8fafc", 
                                            borderRadius: "6px",
                                            fontSize: "11px",
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                            fontFamily: "'Courier New', monospace"
                                          }}>
                                            {task.logs}
                                          </pre>
                                        </div>
                                      )}

                                      {!task.output && !task.error && !task.logs && (
                                        <div style={{ color: "#9ca3af", fontSize: "12px", fontStyle: "italic" }}>
                                          No output available
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ color: "#6b7280" }}>No tasks found for this execution</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
