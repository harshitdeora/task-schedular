import React from "react";
import { Handle, Position } from "reactflow";

export default function TaskNode({ data }) {
  const bg =
    data.type === "http" ? "#b3e5fc" :
    data.type === "script" ? "#c8e6c9" :
    "#ffe082";

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

      <strong style={{ display: "block", marginBottom: 6 }}>{data.label}</strong>
      <div style={{ fontSize: "0.8em", color: "#555" }}>{data.type}</div>

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
