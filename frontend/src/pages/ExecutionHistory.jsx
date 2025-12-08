import React, { useEffect, useState } from "react";
import { getExecutions, retryExecution, deleteExecution, deleteAllExecutions } from "../api/executionApi";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b"];

export default function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 15000); // Reduced to 15 seconds
    return () => clearInterval(interval);
  }, [filter]); // Refetch when filter changes

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
      // Show error message to user
      alert("Failed to load executions: " + (error.response?.data?.error || error.message));
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
                    
                    return (
                      <tr key={exec._id}>
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
                          </div>
                        </td>
                      </tr>
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
