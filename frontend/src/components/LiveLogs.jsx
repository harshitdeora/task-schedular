import React, { useEffect, useRef } from "react";

export default function LiveLogs({ logs }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={ref}
      style={{
        background: "#111",
        color: "#0f0",
        height: 250,
        padding: "10px",
        overflowY: "scroll",
        fontFamily: "monospace"
      }}
    >
      {logs.map((log, idx) => <div key={idx}>{log}</div>)}
    </div>
  );
}
