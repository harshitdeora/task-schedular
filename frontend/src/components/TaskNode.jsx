import React from "react";
import { Handle, Position } from "reactflow";

const TYPE_COLORS = {
  http: "#b3e5fc",
  email: "#ffccbc",
  database: "#c8e6c9",
  script: "#fff9c4",
  file: "#e1bee7",
  webhook: "#b2dfdb",
  delay: "#ffe082",
  notification: "#f8bbd0",
  transform: "#d1c4e9"
};

const TYPE_ICONS = {
  http: "🌐",
  email: "📧",
  database: "🗄️",
  script: "📜",
  file: "📁",
  webhook: "🔗",
  delay: "⏱️",
  notification: "🔔",
  transform: "🔄"
};

export default function TaskNode({ data }) {
  const bg = TYPE_COLORS[data.type] || "#ffe082";
  const icon = TYPE_ICONS[data.type] || "⚙️";

  // small handle style to make it easier to click
  const handleStyle = {
    width: 12,
    height: 12,
    borderRadius: 6,
    background: "#111",
    border: "2px solid white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  };

  // small label for top/bottom so user sees direction
  const smallLabel = {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  };

  return (
    <div style={{
      padding: 10,
      borderRadius: 8,
      background: bg,
      minWidth: 120,
      textAlign: "center",
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      position: "relative",
    }}>
      {/* top handle (incoming) */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -10 }}>
        <Handle
          type="target"
          id="target"
          position={Position.Top}
          style={handleStyle}
          // helpful for screen reader / debugging
          data-handle="target"
        />
        <div style={smallLabel}>in</div>
      </div>

      <strong style={{ display: "block", marginBottom: 6 }}>{icon} {data.label}</strong>
      <div style={{ fontSize: "0.8em", color: "#555" }}>{data.type}</div>
      <div style={{ fontSize: "0.7em", color: "#888", marginTop: "4px" }}>
        Double-click to configure
      </div>

      {/* bottom handle (outgoing) */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -18 }}>
        <Handle
          type="source"
          id="source"
          position={Position.Bottom}
          style={handleStyle}
          data-handle="source"
        />
        <div style={{ ...smallLabel, marginTop: 2 }}>out</div>
      </div>
    </div>
  );
}
