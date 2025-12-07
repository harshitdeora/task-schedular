import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import ScheduledEmailManager from "../components/ScheduledEmailManager";

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
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Reduced to 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [dagsRes, executionsRes, workersRes] = await Promise.all([
        axios.get(`${API_URL}/api/dags`),
        axios.get(`${API_URL}/api/executions?limit=10`),
        axios.get(`${API_URL}/api/workers`)
      ]);

      const dags = dagsRes.data || [];
      const executions = executionsRes.data || [];
      const workers = workersRes.data || [];

      const runningExecutions = executions.filter(e => e.status === "running");
      const successfulExecutions = executions.filter(e => e.status === "success");
      const successRate = executions.length > 0 
        ? (successfulExecutions.length / executions.length * 100).toFixed(1)
        : 0;

      setStats({
        totalDags: dags.length,
        activeDags: dags.filter(d => !d.isDeleted).length,
        runningTasks: runningExecutions.length,
        totalWorkers: workers.length,
        successRate: parseFloat(successRate)
      });

      setRecentExecutions(executions.slice(0, 5));

      // Prepare chart data (last 24 hours simulation)
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = new Date();
        hour.setHours(hour.getHours() - (23 - i));
        return {
          hour: hour.getHours() + ":00",
          success: Math.floor(Math.random() * 10),
          failed: Math.floor(Math.random() * 3)
        };
      });
      setChartData(hours);

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

        {/* Charts Row */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
          gap: "20px",
          marginBottom: "3rem"
        }}>
          <div className="card">
            <h3 style={{ marginBottom: "20px" }}>Last 24 Hours</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="success" stroke="#10b981" name="Success" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: "20px" }}>Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Success", value: stats.successRate },
                    { name: "Failed", value: 100 - stats.successRate }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
                  {recentExecutions.map((exec) => (
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
                      <td>{exec.timeline?.startedAt ? new Date(exec.timeline.startedAt).toLocaleString() : "N/A"}</td>
                      <td>
                        {exec.timeline?.startedAt && exec.timeline?.completedAt
                          ? `${Math.round((new Date(exec.timeline.completedAt) - new Date(exec.timeline.startedAt)) / 1000)}s`
                          : "Running"}
                      </td>
                    </tr>
                  ))}
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

        {/* Scheduled Email Manager */}
        {user && <ScheduledEmailManager user={user} />}
      </div>
    </div>
  );
}
