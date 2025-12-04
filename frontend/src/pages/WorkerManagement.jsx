import React, { useEffect, useState } from "react";
import { getWorkers, getWorkerStats } from "../api/workerApi";

export default function WorkerManagement() {
  const [workers, setWorkers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const [workersRes, statsRes] = await Promise.all([
        getWorkers(),
        getWorkerStats()
      ]);
      setWorkers(workersRes.data.workers || []);
      setStats(statsRes.data.stats || null);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch worker data");
      console.error("Error fetching workers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return "0s";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(" ");
  };

  const formatMemory = (mb) => {
    if (!mb) return "0 MB";
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb} MB`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
      case "idle":
        return "#4caf50";
      case "busy":
        return "#ff9800";
      case "offline":
        return "#f44336";
      default:
        return "#757575";
    }
  };

  const getStatusBadge = (status) => {
    const color = getStatusColor(status);
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: "12px",
          backgroundColor: color,
          color: "white",
          fontSize: "12px",
          fontWeight: "bold",
          textTransform: "uppercase"
        }}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Worker Management</h2>
        <p>Loading worker data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Worker Management</h2>
        <div style={{ color: "red", padding: "1rem", backgroundColor: "#ffebee", borderRadius: "4px" }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>Worker Management Dashboard</h1>
        <button
          onClick={fetchData}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem"
          }}
        >
          <div style={{ padding: "1rem", backgroundColor: "#e3f2fd", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1976d2" }}>
              {stats.totalWorkers}
            </div>
            <div style={{ color: "#666" }}>Total Workers</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#e8f5e9", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#388e3c" }}>
              {stats.activeWorkers}
            </div>
            <div style={{ color: "#666" }}>Active Workers</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#ffebee", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d32f2f" }}>
              {stats.offlineWorkers}
            </div>
            <div style={{ color: "#666" }}>Offline Workers</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#fff3e0", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f57c00" }}>
              {stats.totalTasksInProgress}
            </div>
            <div style={{ color: "#666" }}>Tasks In Progress</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#e8f5e9", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#388e3c" }}>
              {stats.totalTasksCompleted}
            </div>
            <div style={{ color: "#666" }}>Tasks Completed</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#ffebee", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d32f2f" }}>
              {stats.totalTasksFailed}
            </div>
            <div style={{ color: "#666" }}>Tasks Failed</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#f3e5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#7b1fa2" }}>
              {stats.avgCpu.toFixed(2)}
            </div>
            <div style={{ color: "#666" }}>Avg CPU Load</div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "#e1f5fe", borderRadius: "8px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0277bd" }}>
              {formatMemory(stats.avgMemory)}
            </div>
            <div style={{ color: "#666" }}>Avg Memory</div>
          </div>
        </div>
      )}

      {/* Worker List */}
      <h2 style={{ marginBottom: "1rem" }}>Workers</h2>
      {workers.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          No workers found. Start a worker process to see it here.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: "1rem"
          }}
        >
          {workers.map((worker) => (
            <div
              key={worker._id || worker.workerId}
              style={{
                padding: "1.5rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                backgroundColor: worker.status === "offline" ? "#fafafa" : "white",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "18px" }}>{worker.workerId}</h3>
                {getStatusBadge(worker.status)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "14px" }}>
                <div>
                  <strong>CPU:</strong> {worker.cpu?.toFixed(2) || "0.00"}
                </div>
                <div>
                  <strong>Memory:</strong> {formatMemory(worker.memory)}
                </div>
                <div>
                  <strong>Uptime:</strong> {formatUptime(worker.uptime)}
                </div>
                <div>
                  <strong>Tasks:</strong> {worker.tasksInProgress || 0} in progress
                </div>
                <div>
                  <strong>Completed:</strong> {worker.tasksCompleted || 0}
                </div>
                <div>
                  <strong>Failed:</strong> {worker.tasksFailed || 0}
                </div>
              </div>

              <div style={{ marginTop: "1rem", fontSize: "12px", color: "#666" }}>
                <div>
                  <strong>Last Heartbeat:</strong>{" "}
                  {worker.lastHeartbeat
                    ? new Date(worker.lastHeartbeat).toLocaleString()
                    : "Never"}
                </div>
                {worker.startedAt && (
                  <div>
                    <strong>Started:</strong> {new Date(worker.startedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

