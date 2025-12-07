import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import LiveLogs from "../components/LiveLogs";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { getExecutions } from "../api/executionApi";

const WORKER_SOCKET_URL = import.meta.env.VITE_WORKER_SOCKET_URL || "http://localhost:7000";
const socket = io(WORKER_SOCKET_URL);

export default function ExecutionMonitor() {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 10000); // Reduced to 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.on("task:update", (data) => {
      setTasks((prev) => {
        const filtered = prev.filter(t => t.taskId !== data.taskId);
        return [...filtered, data];
      });
      setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${data.name} → ${data.status}`]);
      
      // Refresh executions when task updates
      if (data.executionId) {
        fetchExecutions();
      }
    });

    socket.on("execution:update", (data) => {
      setExecutions((prev) => {
        const filtered = prev.filter(e => e._id !== data._id);
        return [data, ...filtered];
      });
      
      // Update selected execution if it's the one being updated
      setSelectedExecution((prev) => {
        if (prev && prev._id === data._id) {
          return data;
        }
        return prev;
      });
      
      // Refresh to get full execution details
      fetchExecutions();
    });

    return () => {
      socket.off("task:update");
      socket.off("execution:update");
    };
  }, [selectedExecution]);

  const fetchExecutions = async () => {
    try {
      // Fetch both running and recent completed executions
      const [runningRes, recentRes] = await Promise.all([
        getExecutions({ limit: 10, status: "running" }),
        getExecutions({ limit: 10, status: "success" })
      ]);
      
      const allExecutions = [
        ...(runningRes.data || []),
        ...(recentRes.data || [])
      ];
      
      setExecutions(allExecutions);
      if (allExecutions.length > 0 && !selectedExecution) {
        setSelectedExecution(allExecutions[0]);
      }
    } catch (error) {
      console.error("Error fetching executions:", error);
    }
  };

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
        <h1 style={{ marginBottom: "2rem" }}>Execution Monitor</h1>

        {/* Running Executions */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Running Executions</h3>
          {executions.length === 0 ? (
            <p>No running executions</p>
          ) : (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {executions.map((exec) => (
                <button
                  key={exec._id}
                  onClick={() => setSelectedExecution(exec)}
                  className={selectedExecution?._id === exec._id ? "custom-btn" : "custom-border-btn"}
                  style={{ textAlign: "left" }}
                >
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    {exec.dagId?.name || "Unknown DAG"}
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    {exec.status} - {exec.timeline?.startedAt ? new Date(exec.timeline.startedAt).toLocaleTimeString() : "N/A"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
          {/* Task Status */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem" }}>Task Status</h3>
            {tasks.length === 0 ? (
              <p>No active tasks. Tasks will appear here when execution starts.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tasks.map((t) => (
                  <div
                    key={t.taskId}
                    style={{
                      padding: "12px",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      backgroundColor: statusColors[t.status] ? `${statusColors[t.status]}20` : "#f5f5f5"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{t.name || t.taskId}</strong>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: "12px",
                          backgroundColor: statusColors[t.status] || "#gray",
                          color: "white",
                          fontSize: "12px"
                        }}
                      >
                        {t.status}
                      </span>
                    </div>
                    {t.error && (
                      <div style={{ marginTop: "8px", color: "#ef4444", fontSize: "12px" }}>
                        Error: {t.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Logs */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem" }}>Live Logs</h3>
            <LiveLogs logs={logs} />
          </div>
        </div>

        {/* Progress Chart */}
        {tasks.length > 0 && (
          <div className="card" style={{ marginTop: "2rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Execution Progress</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tasks.map((t, i) => ({ 
                name: t.name || `Task ${i + 1}`, 
                progress: t.status === "success" ? 100 : t.status === "running" ? 50 : t.status === "failed" ? 0 : 25 
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="progress" stroke="#13547a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Execution Details */}
        {selectedExecution && (
          <div className="card" style={{ marginTop: "2rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Execution Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
              <div>
                <strong>DAG:</strong> {selectedExecution.dagId?.name || "N/A"}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "12px",
                    backgroundColor: statusColors[selectedExecution.status] || "#gray",
                    color: "white",
                    fontSize: "12px"
                  }}
                >
                  {selectedExecution.status}
                </span>
              </div>
              <div>
                <strong>Queued:</strong> {selectedExecution.timeline?.queuedAt ? new Date(selectedExecution.timeline.queuedAt).toLocaleString() : "N/A"}
              </div>
              <div>
                <strong>Started:</strong> {selectedExecution.timeline?.startedAt ? new Date(selectedExecution.timeline.startedAt).toLocaleString() : "N/A"}
              </div>
              <div>
                <strong>Tasks:</strong> {selectedExecution.tasks?.length || 0}
              </div>
              <div>
                <strong>Completed:</strong> {selectedExecution.tasks?.filter(t => t.status === "success").length || 0}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
