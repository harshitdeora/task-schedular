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
    const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
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
    <div className="section-padding">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1>Worker Management</h1>
          <button onClick={fetchData} className="custom-btn">
            Refresh
          </button>
        </div>

      {/* Stats Overview */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "2rem"
          }}
        >
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Total Workers</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.totalWorkers}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Active Workers</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.activeWorkers}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Offline Workers</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.offlineWorkers}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Tasks In Progress</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.totalTasksInProgress}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Tasks Completed</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.totalTasksCompleted}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Tasks Failed</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.totalTasksFailed}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Avg CPU Load</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.avgCpu.toFixed(2)}%</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Avg Memory</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{formatMemory(stats.avgMemory)}</p>
          </div>
        </div>
      )}

      {/* Worker List */}
      <h2 style={{ marginBottom: "1rem" }}>Workers</h2>
      {workers.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p>No workers found. Start a worker process to see it here.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: "20px"
          }}
        >
          {workers.map((worker) => (
            <div key={worker._id || worker.workerId} className="card">
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
    </div>
  );
}

