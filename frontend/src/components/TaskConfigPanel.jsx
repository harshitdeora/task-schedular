import React, { useState, useEffect } from "react";

const TASK_TYPES = [
  { value: "http", label: "HTTP Request", icon: "🌐" },
  { value: "email", label: "Send Email", icon: "📧" },
  { value: "database", label: "Database Query", icon: "🗄️" },
  { value: "script", label: "Script Execution", icon: "📜" },
  { value: "file", label: "File Operation", icon: "📁" },
  { value: "webhook", label: "Webhook", icon: "🔗" },
  { value: "delay", label: "Delay/Wait", icon: "⏱️" },
  { value: "notification", label: "Notification", icon: "🔔" },
  { value: "transform", label: "Data Transform", icon: "🔄" }
];

export default function TaskConfigPanel({ node, onUpdate, onClose }) {
  // Store node ID to track when it changes
  const [nodeId, setNodeId] = useState(node?.id);
  
  // Initialize state from node, but don't reset on every node change
  const [config, setConfig] = useState(() => node?.data?.config || {});
  const [taskName, setTaskName] = useState(() => node?.data?.label || "");
  const [taskType, setTaskType] = useState(() => node?.data?.type || "http");

  // Only update state when a different node is selected (node ID changes)
  // IMPORTANT: Don't reset state when user is typing - only when switching nodes
  useEffect(() => {
    if (node) {
      // Only update if this is a completely different node (different ID)
      if (!nodeId || node.id !== nodeId) {
        setNodeId(node.id);
        setConfig(node.data?.config || {});
        setTaskName(node.data?.label || "");
        setTaskType(node.data?.type || "http");
      }
      // If same node ID, DON'T reset - user might be typing in the form!
    }
  }, [node?.id]); // Only depend on node ID, NOT nodeId to avoid infinite loops

  const handleSave = () => {
    if (!taskName.trim()) {
      alert("Please enter a task name");
      return;
    }

    // Create updated node with all changes
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        label: taskName.trim(), // Ensure trimmed name
        type: taskType,
        config: { ...config } // Ensure config is properly spread
      }
    };

    onUpdate(updatedNode);
    onClose();
  };

  const updateConfig = (key, value) => {
    // Update config state
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      return newConfig;
    });
  };

  const renderConfigFields = () => {
    switch (taskType) {
      case "http":
        const httpMethod = config.method || "GET";
        const showBody = ["POST", "PUT", "PATCH"].includes(httpMethod);
        
        return (
          <>
            <div>
              <label>HTTP Method *</label>
              <select
                value={httpMethod}
                onChange={(e) => {
                  updateConfig("method", e.target.value);
                  // Clear body for GET/DELETE
                  if (["GET", "DELETE"].includes(e.target.value)) {
                    updateConfig("body", null);
                  }
                }}
                className="custom-form form-control"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label>Request URL *</label>
              <input
                type="text"
                value={config.url || ""}
                onChange={(e) => updateConfig("url", e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="custom-form form-control"
              />
              <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                Full URL including protocol (http/https)
              </small>
            </div>
            <div>
              <label>Query Parameters (Key-Value)</label>
              <div style={{ marginBottom: "5px" }}>
                {config.queryParams && Object.keys(config.queryParams || {}).length > 0 ? (
                  Object.entries(config.queryParams || {}).map(([key, value], idx) => (
                    <div key={idx} style={{ display: "flex", gap: "5px", marginBottom: "5px" }}>
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newParams = { ...(config.queryParams || {}) };
                          delete newParams[key];
                          newParams[e.target.value] = value;
                          updateConfig("queryParams", newParams);
                        }}
                        placeholder="Key"
                        style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          updateConfig("queryParams", {
                            ...(config.queryParams || {}),
                            [key]: e.target.value
                          });
                        }}
                        placeholder="Value"
                        style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newParams = { ...(config.queryParams || {}) };
                          delete newParams[key];
                          updateConfig("queryParams", newParams);
                        }}
                        style={{ padding: "5px 10px", background: "#ff4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: "12px", color: "#999", fontStyle: "italic" }}>No query parameters</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    updateConfig("queryParams", {
                      ...(config.queryParams || {}),
                      "": ""
                    });
                  }}
                  style={{ marginTop: "5px", padding: "5px 10px", background: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  + Add Parameter
                </button>
              </div>
            </div>
            <div>
              <label>Headers (Key-Value)</label>
              <div style={{ marginBottom: "5px" }}>
                {config.headers && Object.keys(config.headers || {}).length > 0 ? (
                  Object.entries(config.headers || {}).map(([key, value], idx) => (
                    <div key={idx} style={{ display: "flex", gap: "5px", marginBottom: "5px" }}>
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newHeaders = { ...(config.headers || {}) };
                          delete newHeaders[key];
                          newHeaders[e.target.value] = value;
                          updateConfig("headers", newHeaders);
                        }}
                        placeholder="Header Name"
                        style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          updateConfig("headers", {
                            ...(config.headers || {}),
                            [key]: e.target.value
                          });
                        }}
                        placeholder="Header Value"
                        style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newHeaders = { ...(config.headers || {}) };
                          delete newHeaders[key];
                          updateConfig("headers", newHeaders);
                        }}
                        style={{ padding: "5px 10px", background: "#ff4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: "12px", color: "#999", fontStyle: "italic" }}>No custom headers</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    updateConfig("headers", {
                      ...(config.headers || {}),
                      "": ""
                    });
                  }}
                  style={{ marginTop: "5px", padding: "5px 10px", background: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  + Add Header
                </button>
              </div>
              <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                Common: Authorization, Content-Type, X-API-Key
              </small>
            </div>
            {showBody && (
              <div>
                <label>Request Body (JSON) *</label>
                <textarea
                  value={config.body ? (typeof config.body === "string" ? config.body : JSON.stringify(config.body, null, 2)) : ""}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (!value) {
                      updateConfig("body", null);
                      return;
                    }
                    try {
                      // Try to parse as JSON
                      const parsed = JSON.parse(value);
                      updateConfig("body", parsed);
                    } catch {
                      // If not valid JSON, store as string (will be validated on execution)
                      updateConfig("body", value);
                    }
                  }}
                  placeholder='{"key": "value", "email": "test@example.com"}'
                  className="custom-form form-control"
                  rows="6"
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
                <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                  Valid JSON required. Will be validated before sending.
                </small>
              </div>
            )}
            <div>
              <label>Timeout (milliseconds)</label>
              <input
                type="number"
                value={config.timeout || config.timeoutMs || 30000}
                onChange={(e) => {
                  const ms = parseInt(e.target.value) || 30000;
                  updateConfig("timeout", ms);
                  updateConfig("timeoutMs", ms);
                }}
                min="1000"
                max="300000"
                className="custom-form form-control"
              />
              <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                Default: 30000ms (30 seconds). Max: 300000ms (5 minutes)
              </small>
            </div>
            <div>
              <label>Retry Count</label>
              <input
                type="number"
                value={config.retries || config.retryCount || 0}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 0;
                  updateConfig("retries", count);
                  updateConfig("retryCount", count);
                }}
                min="0"
                max="10"
                className="custom-form form-control"
              />
              <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                Number of automatic retries on failure (0 = no retries)
              </small>
            </div>
            <div style={{ padding: "10px", background: "#e3f2fd", borderRadius: "8px", marginTop: "10px" }}>
              <strong style={{ color: "#13547a", fontSize: "13px" }}>📊 Response Storage:</strong>
              <p style={{ fontSize: "12px", color: "#666", margin: "5px 0 0 0" }}>
                Response will be stored with: status code, response body, headers, duration, and success status.
              </p>
            </div>
          </>
        );

      case "email":
        return (
          <>
            <div>
              <label>To *</label>
              <input
                type="text"
                value={config.to || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateConfig("to", e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="recipient@example.com"
                className="custom-form form-control"
                autoComplete="off"
              />
            </div>
            <div>
              <label>Subject *</label>
              <input
                type="text"
                value={config.subject || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateConfig("subject", e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="Email subject"
                className="custom-form form-control"
                autoComplete="off"
              />
            </div>
            <div>
              <label>Body *</label>
              <textarea
                value={config.body || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateConfig("body", e.target.value);
                }}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="Email body"
                className="custom-form form-control"
                rows="5"
              />
            </div>
            <div>
              <label>Attachments (File Paths)</label>
              <textarea
                value={config.attachments ? (Array.isArray(config.attachments) ? config.attachments.map(a => typeof a === 'string' ? a : a.path || a.filename).join('\n') : '') : ''}
                onChange={(e) => {
                  e.stopPropagation();
                  const paths = e.target.value.split('\n').filter(p => p.trim());
                  updateConfig("attachments", paths.map(path => ({ path: path.trim(), filename: path.split('/').pop().trim() })));
                }}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="reports/daily-report-2024-01-15.txt&#10;logs/error.log"
                className="custom-form form-control"
                rows="3"
              />
              <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                Enter file paths (one per line). Files should be created by previous tasks in your DAG.
                <br />
                Example: <code>reports/daily-report-2024-01-15.txt</code>
              </small>
            </div>
            <div style={{ padding: "10px", background: "#e8f5e9", borderRadius: "8px", marginBottom: "15px" }}>
              <strong style={{ color: "#13547a", fontSize: "13px" }}>📧 Sender Email:</strong>
              <p style={{ fontSize: "12px", color: "#666", margin: "5px 0 0 0" }}>
                Email will be sent from your logged-in email address automatically.
              </p>
            </div>
            <div style={{ marginTop: "15px", padding: "12px", background: "#f0f8ff", borderRadius: "8px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#13547a", fontWeight: "600" }}>
                📅 Schedule Email (Optional)
              </label>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", fontSize: "14px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.scheduled || false}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateConfig("scheduled", e.target.checked);
                      if (!e.target.checked) {
                        updateConfig("scheduledDateTime", "");
                      }
                    }}
                    style={{ marginRight: "8px", width: "18px", height: "18px" }}
                  />
                  Send at specific date & time (instead of when DAG runs)
                </label>
              </div>
              {config.scheduled && (
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", color: "#666" }}>
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={config.scheduledDateTime || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateConfig("scheduledDateTime", e.target.value);
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onBlur={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    min={new Date().toISOString().slice(0, 16)}
                    className="custom-form form-control"
                    style={{ fontSize: "14px" }}
                  />
                  <small style={{ fontSize: "11px", color: "#666", display: "block", marginTop: "5px" }}>
                    If scheduled, email will be sent at this time. Otherwise, it sends when DAG runs.
                  </small>
                </div>
              )}
            </div>
            <div style={{ padding: "10px", background: "#fff3e0", borderRadius: "8px", marginTop: "10px" }}>
              <strong style={{ color: "#13547a" }}>SMTP Setup:</strong>
              <p style={{ fontSize: "12px", marginTop: "5px", color: "#666" }}>
                Add to <code>backend/.env</code>:<br />
                SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
              </p>
            </div>
          </>
        );

      case "database":
        return (
          <>
            <div>
              <label>Database Type *</label>
              <select
                value={config.databaseType || "mongodb"}
                onChange={(e) => updateConfig("databaseType", e.target.value)}
                className="custom-form form-control"
              >
                <option>mongodb</option>
                <option>postgresql</option>
                <option>mysql</option>
              </select>
            </div>
            <div>
              <label>Collection/Table *</label>
              <input
                type="text"
                value={config.collection || ""}
                onChange={(e) => updateConfig("collection", e.target.value)}
                placeholder="users"
                className="custom-form form-control"
              />
            </div>
            <div>
              <label>Operation *</label>
              <select
                value={config.operation || "find"}
                onChange={(e) => updateConfig("operation", e.target.value)}
                className="custom-form form-control"
              >
                <option>find</option>
                <option>insert</option>
                <option>update</option>
                <option>delete</option>
              </select>
            </div>
            <div>
              <label>Query (JSON)</label>
              <textarea
                value={config.query ? JSON.stringify(config.query, null, 2) : "{}"}
                onChange={(e) => {
                  try {
                    updateConfig("query", JSON.parse(e.target.value));
                  } catch {}
                }}
                placeholder='{"name": "John"}'
                className="custom-form form-control"
                rows="3"
              />
            </div>
            <div>
              <label>Data (JSON, for insert/update)</label>
              <textarea
                value={config.data ? JSON.stringify(config.data, null, 2) : "{}"}
                onChange={(e) => {
                  try {
                    updateConfig("data", JSON.parse(e.target.value));
                  } catch {}
                }}
                placeholder='{"name": "John", "age": 30}'
                className="custom-form form-control"
                rows="3"
              />
            </div>
          </>
        );

      case "script":
        return (
          <>
            <div>
              <label>Language *</label>
              <select
                value={config.language || "node"}
                onChange={(e) => updateConfig("language", e.target.value)}
                className="custom-form form-control"
              >
                <option>node</option>
                <option>python</option>
                <option>bash</option>
              </select>
            </div>
            <div>
              <label>Script *</label>
              <textarea
                value={config.script || ""}
                onChange={(e) => updateConfig("script", e.target.value)}
                placeholder="console.log('Hello World');"
                className="custom-form form-control"
                rows="10"
                style={{ fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label>Timeout (seconds)</label>
              <input
                type="number"
                value={config.timeoutSeconds || 60}
                onChange={(e) => updateConfig("timeoutSeconds", parseInt(e.target.value))}
                className="custom-form form-control"
              />
            </div>
          </>
        );

      case "file":
        return (
          <>
            <div>
              <label>Operation *</label>
              <select
                value={config.operation || "read"}
                onChange={(e) => updateConfig("operation", e.target.value)}
                className="custom-form form-control"
              >
                <option>read</option>
                <option>write</option>
                <option>append</option>
                <option>delete</option>
                <option>copy</option>
                <option>exists</option>
              </select>
            </div>
            <div>
              <label>File Path *</label>
              <input
                type="text"
                value={config.filePath || ""}
                onChange={(e) => updateConfig("filePath", e.target.value)}
                placeholder="/path/to/file.txt"
                className="custom-form form-control"
              />
            </div>
            {["write", "append"].includes(config.operation) && (
              <div>
                <label>Content *</label>
                <textarea
                  value={config.content || ""}
                  onChange={(e) => updateConfig("content", e.target.value)}
                  placeholder="File content"
                  className="custom-form form-control"
                  rows="5"
                />
              </div>
            )}
            {config.operation === "copy" && (
              <div>
                <label>Destination *</label>
                <input
                  type="text"
                  value={config.destination || ""}
                  onChange={(e) => updateConfig("destination", e.target.value)}
                  placeholder="/path/to/destination.txt"
                  className="custom-form form-control"
                />
              </div>
            )}
          </>
        );

      case "webhook":
        return (
          <>
            <div>
              <label>Webhook URL *</label>
              <input
                type="text"
                value={config.url || ""}
                onChange={(e) => updateConfig("url", e.target.value)}
                placeholder="https://webhook.site/unique-id"
                className="custom-form form-control"
              />
            </div>
            <div>
              <label>Method</label>
              <select
                value={config.method || "POST"}
                onChange={(e) => updateConfig("method", e.target.value)}
                className="custom-form form-control"
              >
                <option>POST</option>
                <option>PUT</option>
                <option>GET</option>
              </select>
            </div>
            <div>
              <label>Payload (JSON)</label>
              <textarea
                value={config.payload ? JSON.stringify(config.payload, null, 2) : "{}"}
                onChange={(e) => {
                  try {
                    updateConfig("payload", JSON.parse(e.target.value));
                  } catch {}
                }}
                placeholder='{"event": "task_completed"}'
                className="custom-form form-control"
                rows="5"
              />
            </div>
            <div>
              <label>Secret (for signature)</label>
              <input
                type="text"
                value={config.secret || ""}
                onChange={(e) => updateConfig("secret", e.target.value)}
                placeholder="Optional webhook secret"
                className="custom-form form-control"
              />
            </div>
          </>
        );

      case "delay":
        return (
          <>
            <div>
              <label>Duration (seconds) *</label>
              <input
                type="number"
                value={config.durationSeconds || 1}
                onChange={(e) => updateConfig("durationSeconds", parseInt(e.target.value))}
                min="0"
                max="3600"
                className="custom-form form-control"
              />
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              Or specify milliseconds: <input
                type="number"
                value={config.durationMs || ""}
                onChange={(e) => updateConfig("durationMs", parseInt(e.target.value))}
                placeholder="Optional"
                style={{ width: "100px", padding: "5px" }}
              />
            </div>
          </>
        );

      case "notification":
        return (
          <>
            <div>
              <label>Platform *</label>
              <select
                value={config.platform || "slack"}
                onChange={(e) => updateConfig("platform", e.target.value)}
                className="custom-form form-control"
              >
                <option>slack</option>
                <option>discord</option>
              </select>
            </div>
            <div>
              <label>Webhook URL *</label>
              <input
                type="text"
                value={config.webhookUrl || ""}
                onChange={(e) => updateConfig("webhookUrl", e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="custom-form form-control"
              />
            </div>
            <div>
              <label>Message *</label>
              <textarea
                value={config.message || ""}
                onChange={(e) => updateConfig("message", e.target.value)}
                placeholder="Notification message"
                className="custom-form form-control"
                rows="3"
              />
            </div>
            <div>
              <label>Title</label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => updateConfig("title", e.target.value)}
                placeholder="Optional title"
                className="custom-form form-control"
              />
            </div>
          </>
        );

      case "transform":
        return (
          <>
            <div>
              <label>Input Data (JSON)</label>
              <textarea
                value={config.inputData ? JSON.stringify(config.inputData, null, 2) : "{}"}
                onChange={(e) => {
                  try {
                    updateConfig("inputData", JSON.parse(e.target.value));
                  } catch {}
                }}
                placeholder='{"data": "to transform"}'
                className="custom-form form-control"
                rows="3"
              />
            </div>
            <div>
              <label>Transform Function (JavaScript) *</label>
              <textarea
                value={config.transformFunction || ""}
                onChange={(e) => updateConfig("transformFunction", e.target.value)}
                placeholder="input.data.toUpperCase()"
                className="custom-form form-control"
                rows="5"
                style={{ fontFamily: "monospace" }}
              />
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              The function receives 'input' as parameter. Return the transformed value.
            </div>
          </>
        );

      default:
        return <p>Select a task type to configure</p>;
    }
  };

  // Prevent closing when clicking inside the panel
  const handlePanelClick = (e) => {
    e.stopPropagation();
  };

  // Prevent input events from bubbling
  const handleInputEvent = (e) => {
    e.stopPropagation();
  };

  if (!node) return null;

  return (
    <div 
      onClick={handlePanelClick}
      onMouseDown={handleInputEvent}
      onKeyDown={handleInputEvent}
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: "400px",
        height: "100vh",
        background: "white",
        boxShadow: "-2px 0 10px rgba(0,0,0,0.1)",
        padding: "20px",
        overflowY: "auto",
        zIndex: 1000
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3>Task Configuration</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>×</button>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label>Task Name *</label>
        <input
          type="text"
          value={taskName}
          onChange={(e) => {
            e.stopPropagation();
            setTaskName(e.target.value);
          }}
          onFocus={(e) => e.stopPropagation()}
          onBlur={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="custom-form form-control"
          placeholder="Enter task name"
          autoComplete="off"
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label>Task Type *</label>
        <select
          value={taskType}
          onChange={(e) => {
            setTaskType(e.target.value);
            setConfig({}); // Reset config when type changes
          }}
          className="custom-form form-control"
        >
          {TASK_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.icon} {type.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>Configuration</label>
        <div style={{ marginTop: "10px" }}>
          {renderConfigFields()}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={handleSave} className="custom-btn" style={{ flex: 1 }}>
          Save
        </button>
        <button onClick={onClose} className="custom-border-btn" style={{ flex: 1 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

