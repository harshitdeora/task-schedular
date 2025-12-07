import React, { useEffect, useState } from "react";
import { getExecutions, retryExecution } from "../api/executionApi";
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
  }, []);

  const fetchExecutions = async () => {
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const res = await getExecutions(params);
      setExecutions(res.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching executions:", error);
      setLoading(false);
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

  const statusCounts = {
    success: executions.filter(e => e.status === "success").length,
    failed: executions.filter(e => e.status === "failed").length,
    running: executions.filter(e => e.status === "running").length,
    queued: executions.filter(e => e.status === "queued").length
  };

  const pieData = [
    { name: "Success", value: statusCounts.success },
    { name: "Failed", value: statusCounts.failed },
    { name: "Running", value: statusCounts.running },
    { name: "Queued", value: statusCounts.queued }
  ];

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
      success: dayExecutions.filter(e => e.status === "success").length,
      failed: dayExecutions.filter(e => e.status === "failed").length
    };
  });

  const statusColors = {
    success: "#10b981",
    failed: "#ef4444",
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
          {["all", "success", "failed", "running", "queued"].map(status => (
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
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
          gap: "20px",
          marginBottom: "3rem"
        }}>
          <div className="card">
            <h3 style={{ marginBottom: "20px" }}>Status Distribution</h3>
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
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
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
                <Line type="monotone" dataKey="success" stroke="#10b981" name="Success" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Executions Table */}
        <div className="card">
          <h3 style={{ marginBottom: "20px" }}>All Executions</h3>
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
                    const duration = exec.timeline?.startedAt && exec.timeline?.completedAt
                      ? Math.round((new Date(exec.timeline.completedAt) - new Date(exec.timeline.startedAt)) / 1000)
                      : exec.timeline?.startedAt
                      ? "Running..."
                      : "N/A";

                    return (
                      <tr key={exec._id}>
                        <td>{exec.dagId?.name || "N/A"}</td>
                        <td>
                          <span style={{
                            padding: "4px 12px",
                            borderRadius: "12px",
                            backgroundColor: statusColors[exec.status] || "#gray",
                            color: "white",
                            fontSize: "12px"
                          }}>
                            {exec.status}
                          </span>
                        </td>
                        <td>{exec.timeline?.queuedAt ? new Date(exec.timeline.queuedAt).toLocaleString() : "N/A"}</td>
                        <td>{exec.timeline?.startedAt ? new Date(exec.timeline.startedAt).toLocaleString() : "N/A"}</td>
                        <td>{exec.timeline?.completedAt ? new Date(exec.timeline.completedAt).toLocaleString() : "N/A"}</td>
                        <td>{duration}</td>
                        <td>
                          {exec.status === "failed" && (
                            <button
                              onClick={() => handleRetry(exec._id)}
                              className="custom-btn"
                              style={{ padding: "4px 12px", fontSize: "12px" }}
                            >
                              Retry
                            </button>
                          )}
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
