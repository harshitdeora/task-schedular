import React from "react";
import { Handle, Position } from "reactflow";

const TYPE_COLORS = {
  http: "rgba(37,99,235,0.18)",
  email: "rgba(56,189,248,0.18)",
  database: "rgba(52,211,153,0.16)",
  script: "rgba(234,179,8,0.16)",
  file: "rgba(192,132,252,0.16)",
  webhook: "rgba(45,212,191,0.16)",
  delay: "rgba(245,158,11,0.16)",
  notification: "rgba(248,113,113,0.16)",
  transform: "rgba(129,140,248,0.16)",
  condition: "rgba(248,187,208,0.16)",
  ai_logic: "rgba(179,157,219,0.16)",
  pdf_gen: "rgba(144,202,249,0.16)",
  json_filter: "rgba(165,214,167,0.16)",
  image_proc: "rgba(206,147,216,0.16)",
  html_to_md: "rgba(255,204,188,0.16)",
  pause: "rgba(255,171,145,0.16)",
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
  transform: "🔄",
  condition: "🔀",
  ai_logic: "🤖",
  pdf_gen: "📄",
  json_filter: "🔍",
  image_proc: "🖼️",
  html_to_md: "📝",
  pause: "⏸️"
};

export default function TaskNode({ data }) {
  const bg = TYPE_COLORS[data.type] || "#ffe082";
  const icon = TYPE_ICONS[data.type] || "⚙️";

  // small handle style to make it easier to click
  const handleStyle = {
    width: 12,
    height: 12,
    borderRadius: 6,
    background: "#020617",
    border: "2px solid #60a5fa",
    boxShadow: "0 0 0 1px rgba(15,23,42,0.9)",
  };

  // small label for top/bottom so user sees direction
  const smallLabel = {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  };

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: `linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9)), ${bg}`,
        minWidth: 140,
        textAlign: "center",
        boxShadow:
          "0 18px 40px rgba(15,23,42,0.96), 0 0 0 1px rgba(30,64,175,0.7)",
        position: "relative",
        border: "1px solid rgba(37,99,235,0.7)",
      }}
    >
      {/* top handle (incoming) */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -10 }}>
        <Handle
          type="target"
          id="target"
          position={Position.Top}
          style={handleStyle}
          data-handle="target"
        />
        <div style={smallLabel}>in</div>
      </div>

      <strong
        style={{
          display: "block",
          marginBottom: 4,
          color: "#e5e7eb",
          fontSize: "13px",
        }}
      >
        {icon} {data.label}
      </strong>
      <div style={{ fontSize: "0.75em", color: "#9ca3af" }}>{data.type}</div>
      <div
        style={{
          fontSize: "0.7em",
          color: "#6b7280",
          marginTop: "4px",
        }}
      >
        Double-click to configure
      </div>

      {/* bottom handles (outgoing) - success and failure */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -18, display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          <Handle
            type="source"
            id="source"
            position={Position.Bottom}
            style={{ ...handleStyle, background: "#10b981" }}
            data-handle="source"
          />
          <div style={{ ...smallLabel, marginTop: 2, fontSize: 9 }}>success</div>
        </div>
        <div style={{ position: 'relative' }}>
          <Handle
            type="source"
            id="failure"
            position={Position.Bottom}
            style={{ ...handleStyle, background: "#ef4444" }}
            data-handle="failure"
          />
          <div style={{ ...smallLabel, marginTop: 2, fontSize: 9 }}>failure</div>
        </div>
      </div>
    </div>
  );
}
