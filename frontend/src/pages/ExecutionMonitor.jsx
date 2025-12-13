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

        {/* Currently Running Task - Prominent Display */}
        {tasks.some(t => t.status === "running" || t.status === "started") && (
          <div className="card" style={{ 
            marginBottom: "2rem", 
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "white",
            border: "none"
          }}>
            <h3 style={{ marginBottom: "1rem", color: "white" }}>⚡ Currently Running Task</h3>
            {tasks
              .filter(t => t.status === "running" || t.status === "started")
              .map((t) => (
                <div key={t.taskId} style={{ 
                  padding: "15px", 
                  background: "rgba(255, 255, 255, 0.1)", 
                  borderRadius: "8px",
                  marginBottom: "10px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "5px" }}>
                        {t.name || t.taskId}
                      </div>
                      <div style={{ fontSize: "14px", opacity: 0.9 }}>
                        Execution ID: {t.executionId?.slice(-8) || "N/A"}
                      </div>
                      {t.timestamp && (
                        <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "5px" }}>
                          Started: {new Date(t.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      fontSize: "14px",
                      fontWeight: "bold"
                    }}>
                      {t.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Running Executions */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Running Executions</h3>
          {executions.length === 0 ? (
            <p>No running executions</p>
          ) : (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {executions.map((exec) => {
                // Find current running task for this execution
                const currentTask = tasks.find(t => 
                  t.executionId === exec._id && (t.status === "running" || t.status === "started")
                );
                
                return (
                  <button
                    key={exec._id}
                    onClick={() => setSelectedExecution(exec)}
                    className={selectedExecution?._id === exec._id ? "custom-btn" : "custom-border-btn"}
                    style={{ textAlign: "left", position: "relative" }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                      {exec.dagId?.name || "Unknown DAG"}
                    </div>
                    <div style={{ fontSize: "12px" }}>
                      {exec.status} - {exec.timeline?.startedAt ? new Date(exec.timeline.startedAt).toLocaleTimeString() : "N/A"}
                    </div>
                    {currentTask && (
                      <div style={{ 
                        fontSize: "11px", 
                        color: "#3b82f6", 
                        marginTop: "4px",
                        fontWeight: "bold"
                      }}>
                        ▶ {currentTask.name}
                      </div>
                    )}
                  </button>
                );
              })}
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
                {tasks
                  .sort((a, b) => {
                    // Sort: running first, then started, then others
                    const order = { running: 0, started: 1, success: 2, failed: 3, queued: 4 };
                    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
                  })
                  .map((t) => {
                    const isRunning = t.status === "running" || t.status === "started";
                    return (
                      <div
                        key={t.taskId}
                        style={{
                          padding: "12px",
                          border: isRunning ? "2px solid #3b82f6" : "1px solid #ddd",
                          borderRadius: "8px",
                          backgroundColor: isRunning 
                            ? "#3b82f620" 
                            : statusColors[t.status] 
                              ? `${statusColors[t.status]}20` 
                              : "#f5f5f5",
                          boxShadow: isRunning ? "0 2px 8px rgba(59, 130, 246, 0.3)" : "none"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <strong>{t.name || t.taskId}</strong>
                            {isRunning && (
                              <span style={{ 
                                marginLeft: "10px", 
                                fontSize: "11px", 
                                color: "#3b82f6",
                                fontWeight: "bold",
                                animation: "pulse 2s infinite"
                              }}>
                                ▶ Currently Running
                              </span>
                            )}
                          </div>
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
                        {t.timestamp && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#666" }}>
                            {new Date(t.timestamp).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
