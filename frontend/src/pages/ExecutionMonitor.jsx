import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import LiveLogs from "../components/LiveLogs";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const socket = io("http://localhost:7000");

export default function ExecutionMonitor() {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    socket.on("task:update", (data) => {
      setTasks((prev) => {
        const filtered = prev.filter(t => t.taskId !== data.taskId);
        return [...filtered, data];
      });
      setLogs((prev) => [...prev, `${data.timestamp}: ${data.name} → ${data.status}`]);
    });
    return () => socket.disconnect();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Execution Monitor (Live)</h2>
      <div style={{ display: "flex", gap: "2rem" }}>
        <div style={{ flex: 1 }}>
          <h3>Task Status</h3>
          <ul>
            {tasks.map(t => (
              <li key={t.taskId}>
                <strong>{t.name}</strong>: {t.status}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Live Logs</h3>
          <LiveLogs logs={logs} />
        </div>
      </div>

      <h3 style={{ marginTop: "2rem" }}>Execution Progress (Mocked)</h3>
      <LineChart width={600} height={250} data={tasks.map((t, i) => ({ name: t.name, progress: i * 10 }))}>
        <CartesianGrid stroke="#ccc" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="progress" stroke="#8884d8" />
      </LineChart>
    </div>
  );
}
