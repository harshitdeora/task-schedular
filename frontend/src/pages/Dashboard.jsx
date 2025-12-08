import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({
    totalDags: 0,
    activeDags: 0,
    runningTasks: 0,
    totalWorkers: 0,
    successRate: 0
  });
  const [recentExecutions, setRecentExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset state when user changes
    setStats({
      totalDags: 0,
      activeDags: 0,
      runningTasks: 0,
      totalWorkers: 0,
      successRate: 0
    });
    setRecentExecutions([]);
    setLoading(true);
    
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Reduced to 10 seconds
    return () => clearInterval(interval);
  }, [user?.id]); // Re-fetch when user changes

  const fetchDashboardData = async () => {
    try {
      const [dagsRes, executionsRes, workersRes] = await Promise.all([
        axios.get(`${API_URL}/api/dags`, { withCredentials: true }),
        axios.get(`${API_URL}/api/executions?limit=10`, { withCredentials: true }),
        axios.get(`${API_URL}/api/workers`, { withCredentials: true })
      ]);

      const dags = dagsRes.data || [];
      const executions = executionsRes.data || [];
      const workers = workersRes.data || [];

      const runningExecutions = executions.filter(e => e.status === "running" || e.status === "queued");
      const successfulExecutions = executions.filter(e => e.status === "success");
      const successRate = executions.length > 0 
        ? (successfulExecutions.length / executions.length * 100).toFixed(1)
        : 0;

      // Count DAGs that have active (running or queued) executions
      const activeDagIds = new Set(
        runningExecutions
          .map(e => e.dagId?._id || e.dagId)
          .filter(id => id !== null && id !== undefined)
      );
      const activeDagsCount = activeDagIds.size;

      setStats({
        totalDags: dags.length,
        activeDags: activeDagsCount,
        runningTasks: runningExecutions.length,
        totalWorkers: workers.length,
        successRate: parseFloat(successRate)
      });

      setRecentExecutions(executions.slice(0, 5));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  const statusColors = {
    success: "#10b981",
    failed: "#ef4444",
    running: "#3b82f6",
    queued: "#f59e0b"
  };

  return (
    <div className="section-padding">
      <div className="container">
        <h1 style={{ marginBottom: "2rem" }}>Dashboard</h1>

        {/* Stats Cards */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "20px",
          marginBottom: "3rem"
        }}>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Total DAGs</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.totalDags}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Active DAGs</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.activeDags}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Running Tasks</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.runningTasks}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Workers</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.totalWorkers}</p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>Success Rate</h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>{stats.successRate}%</p>
          </div>
        </div>

        {/* Recent Executions */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3>Recent Executions</h3>
            <Link to="/history" className="custom-btn">View All</Link>
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : recentExecutions.length === 0 ? (
            <p>No executions yet</p>
          ) : (
            <div className="table">
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>DAG Name</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.map((exec) => {
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
                      <td>
                        {exec.timeline?.startedAt 
                          ? new Date(exec.timeline.startedAt).toLocaleString() 
                          : exec.status === "queued" 
                            ? "Queued..." 
                            : "N/A"}
                      </td>
                      <td>
                        {exec.timeline?.startedAt && exec.timeline?.completedAt
                          ? `${Math.round((new Date(exec.timeline.completedAt) - new Date(exec.timeline.startedAt)) / 1000)}s`
                          : exec.status === "success" || exec.status === "failed"
                            ? exec.timeline?.startedAt
                              ? `${Math.round((new Date() - new Date(exec.timeline.startedAt)) / 1000)}s`
                              : "N/A"
                            : "Running..."}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ marginTop: "2rem", display: "flex", gap: "15px" }}>
          <Link to="/builder" className="custom-btn">Create New DAG</Link>
          <Link to="/dags" className="custom-border-btn">View All DAGs</Link>
        </div>

      </div>
    </div>
  );
}
