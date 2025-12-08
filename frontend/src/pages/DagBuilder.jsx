import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";
import { hasCycle } from "../utils/validateDAG";
import TaskNode from "../components/TaskNode";
import TaskConfigPanel from "../components/TaskConfigPanel";
import { createDag, getDagById, updateDag } from "../api/dagApi";
import { v4 as uuidv4 } from "uuid";
import { useSearchParams } from "react-router-dom";

const nodeTypes = { taskNode: TaskNode };

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.Arrow },
  style: { stroke: "#13547a", strokeWidth: 2 }
};

const TASK_TYPES = [
  { value: "http", label: "HTTP Request", icon: "🌐", color: "#b3e5fc", description: "Call APIs" },
  { value: "email", label: "Send Email", icon: "📧", color: "#ffccbc", description: "Send emails" },
  { value: "database", label: "Database", icon: "🗄️", color: "#c8e6c9", description: "Query DB" },
  { value: "script", label: "Script", icon: "📜", color: "#fff9c4", description: "Run code" },
  { value: "file", label: "File", icon: "📁", color: "#e1bee7", description: "File ops" },
  { value: "webhook", label: "Webhook", icon: "🔗", color: "#b2dfdb", description: "Webhooks" },
  { value: "delay", label: "Delay", icon: "⏱️", color: "#ffe082", description: "Wait time" },
  { value: "notification", label: "Notification", icon: "🔔", color: "#f8bbd0", description: "Alerts" },
  { value: "transform", label: "Transform", icon: "🔄", color: "#d1c4e9", description: "Transform data" }
];

export default function DagBuilder() {
  const [searchParams] = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dagName, setDagName] = useState("");
  const [dagDescription, setDagDescription] = useState("");
  const [dagId, setDagId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showTaskPalette, setShowTaskPalette] = useState(true);
  const [showDagSettings, setShowDagSettings] = useState(false);
  const [taskNameInput, setTaskNameInput] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState(null);
  const [schedule, setSchedule] = useState({
    enabled: false,
    type: "manual",
    cronExpression: "",
    intervalSeconds: 60,
    timezone: "UTC"
  });

  const onConnect = useCallback((params) => {
    if (!params || !params.source || !params.target) return;
    if (params.source === params.target) {
      setError("Cannot connect a node to itself.");
      return;
    }
    if (edges.some(e => e.source === params.source && e.target === params.target)) {
      setError("Edge already exists.");
      return;
    }
    const tempEdges = [...edges, { source: params.source, target: params.target }];
    if (hasCycle(nodes, tempEdges)) {
      setError("❌ Cycle detected! DAG must be acyclic.");
      return;
    }
    setError("");
    const edgeWithArrow = {
      ...params,
      id: params.id || uuidv4(),
      markerEnd: { type: MarkerType.Arrow },
      style: { stroke: "#13547a", strokeWidth: 2 }
    };
    setEdges((eds) => addEdge(edgeWithArrow, eds));
  }, [edges, nodes, setEdges]);

  useEffect(() => {
    const id = searchParams.get("dagId");
    if (id) loadDAG(id);
  }, [searchParams]);

  const loadDAG = async (id) => {
    try {
      const res = await getDagById(id);
      const dag = res.data;
      setDagId(dag._id);
      setDagName(dag.name);
      setDagDescription(dag.description || "");
      
      if (dag.schedule) {
        setSchedule({
          enabled: dag.schedule.enabled || false,
          type: dag.schedule.type || "manual",
          cronExpression: dag.schedule.cronExpression || "",
          intervalSeconds: dag.schedule.intervalSeconds || 60,
          timezone: dag.schedule.timezone || "UTC"
        });
      }

      const flowNodes = dag.graph.nodes.map(n => ({
        id: n.id,
        type: "taskNode",
        position: n.position || { x: Math.random() * 800, y: Math.random() * 500 },
        data: { label: n.name, type: n.type, config: n.config || {} }
      }));

      const flowEdges = dag.graph.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type || "success",
        markerEnd: { type: MarkerType.Arrow },
        style: { stroke: "#13547a", strokeWidth: 2 }
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error("Error loading DAG:", error);
      alert("Failed to load DAG: " + error.message);
    }
  };

  const handleTaskTypeSelect = useCallback((type) => {
    setSelectedTaskType(type);
    // Don't clear taskNameInput - preserve user's input
  }, []);

  const addNode = useCallback((type, customName = null) => {
    const id = uuidv4().slice(0, 8);
    const taskType = TASK_TYPES.find(t => t.value === type);
    const finalName = customName && customName.trim() 
      ? customName.trim() 
      : `${taskType?.icon || ""} ${taskType?.label || type}`;

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "taskNode",
        position: { x: Math.random() * 800 + 50, y: Math.random() * 500 + 50 },
        data: { label: finalName, type, config: {} }
      }
    ]);

    setSelectedTaskType(null);
    setTaskNameInput("");
  }, []);

  const handleAddTaskWithName = useCallback(() => {
    if (!selectedTaskType) {
      alert("Please select a task type first");
      return;
    }
    addNode(selectedTaskType, taskNameInput);
  }, [selectedTaskType, taskNameInput, addNode]);

  const handleNodeDoubleClick = useCallback((event, node) => {
    event.stopPropagation();
    // Find the current node from nodes array to ensure we have latest reference
    setNodes((currentNodes) => {
      const currentNode = currentNodes.find(n => n.id === node.id);
      if (currentNode) {
        setSelectedNode({ ...currentNode }); // Create new object reference
        return currentNodes;
      }
      setSelectedNode({ ...node });
      return currentNodes;
    });
  }, []);

  const handleNodeUpdate = useCallback((updatedNode) => {
    // Update the node in the nodes array
    setNodes((nds) => {
      const updated = nds.map(n => n.id === updatedNode.id ? updatedNode : n);
      // Update selected node to match the updated version
      setSelectedNode(prev => {
        if (prev && prev.id === updatedNode.id) {
          return updatedNode;
        }
        return prev;
      });
      return updated;
    });
  }, []);

  const handleSave = async () => {
    if (!dagName.trim()) return alert("Please enter DAG name");
    setSaving(true);

    const graph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.type,
        name: n.data.label,
        config: n.data.config || {},
        position: n.position
      })),
      edges: edges.map(e => ({
        id: e.id || uuidv4(),
        source: e.source,
        target: e.target,
        type: e.type || "success"
      }))
    };

    const dagData = {
      name: dagName,
      description: dagDescription,
      graph,
      schedule: schedule.enabled ? {
        enabled: true,
        type: schedule.type,
        cronExpression: schedule.type === "cron" ? schedule.cronExpression : undefined,
        intervalSeconds: schedule.type === "interval" ? schedule.intervalSeconds : undefined,
        timezone: schedule.timezone
      } : { enabled: false, type: "manual" },
      isActive: true
    };

    try {
      if (dagId) {
        await updateDag(dagId, dagData);
        alert("✅ DAG updated!");
      } else {
        const res = await createDag(dagData);
        setDagId(res.data.dag._id);
        alert("✅ DAG saved!");
      }
    } catch (err) {
      console.error("Failed to save DAG:", err);
      alert("Failed to save DAG: " + (err?.response?.data?.error || err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.edges.length > 0) {
          setEdges((eds) => eds.filter(edge => !selection.edges.includes(edge.id)));
        }
        if (selection.nodes.length > 0) {
          setNodes((nds) => nds.filter(node => !selection.nodes.includes(node.id)));
          setEdges((eds) => eds.filter(edge => !selection.nodes.includes(edge.source) && !selection.nodes.includes(edge.target)));
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection, setEdges, setNodes]);

  const onSelectionChange = useCallback(({ nodes: selNodes = [], edges: selEdges = [] }) => {
    setSelection({
      nodes: selNodes.map(n => n.id),
      edges: selEdges.map(e => e.id)
    });
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      {/* Top Toolbar */}
      <div style={{
        background: "rgba(255, 255, 255, 0.95)",
        padding: "15px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h2 style={{ margin: 0, color: "#13547a", fontSize: "24px" }}>🎨 DAG Builder</h2>
          <input
            placeholder="Enter DAG name..."
            value={dagName}
            onChange={(e) => setDagName(e.target.value)}
            style={{
              padding: "8px 15px",
              border: "2px solid #80d0c7",
              borderRadius: "20px",
              fontSize: "14px",
              minWidth: "250px",
              outline: "none"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowTaskPalette(!showTaskPalette)}
            className="custom-btn"
            style={{ padding: "8px 20px", fontSize: "14px" }}
          >
            {showTaskPalette ? "📋 Hide" : "📋 Show"} Tasks
          </button>
          <button
            onClick={() => setShowDagSettings(!showDagSettings)}
            className="custom-border-btn"
            style={{ padding: "8px 20px", fontSize: "14px" }}
          >
            ⚙️ Settings
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="custom-btn"
            style={{ padding: "8px 25px", fontSize: "14px", background: "#13547a" }}
          >
            {saving ? "💾 Saving..." : dagId ? "💾 Update" : "💾 Save DAG"}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Task Palette - Slide in/out */}
        {showTaskPalette && (
          <div style={{
            width: "350px",
            background: "rgba(255, 255, 255, 0.98)",
            borderRight: "2px solid #80d0c7",
            padding: "20px",
            overflowY: "auto",
            boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
            transition: "all 0.3s"
          }}>
            <h3 style={{ marginTop: 0, color: "#13547a", fontSize: "20px", marginBottom: "15px" }}>
              🎯 Task Library
            </h3>

            {/* Task Name Input Section */}
            <div style={{
              padding: "18px",
              background: "linear-gradient(135deg, #f0f8ff 0%, #e3f2fd 100%)",
              borderRadius: "12px",
              marginBottom: "20px",
              border: "2px solid #80d0c7",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>📝</span>
                <label style={{ color: "#13547a", fontWeight: "600", fontSize: "15px" }}>
                  Task Name
                </label>
                <span style={{ fontSize: "11px", color: "#999", marginLeft: "auto" }}>(Optional)</span>
              </div>
              <input
                type="text"
                value={taskNameInput}
                onChange={(e) => setTaskNameInput(e.target.value)}
                placeholder="Enter task name (e.g. Fetch User Data, Send Report Email)"
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #80d0c7",
                  borderRadius: "8px",
                  fontSize: "14px",
                  marginBottom: "12px",
                  outline: "none",
                  transition: "all 0.3s"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#13547a";
                  e.target.style.boxShadow = "0 0 0 3px rgba(19, 84, 122, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#80d0c7";
                  e.target.style.boxShadow = "none";
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && selectedTaskType) {
                    handleAddTaskWithName();
                  }
                }}
              />
              {selectedTaskType ? (
                <button
                  onClick={handleAddTaskWithName}
                  className="custom-btn"
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    background: "#13547a",
                    fontWeight: "600"
                  }}
                >
                  ➕ Add Task: "{taskNameInput.trim() || TASK_TYPES.find(t => t.value === selectedTaskType)?.label || 'Unnamed Task'}"
                </button>
              ) : (
                <div style={{
                  padding: "10px",
                  background: "#fff3e0",
                  borderRadius: "8px",
                  textAlign: "center"
                }}>
                  <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>
                    👇 Select a task type below first
                  </p>
                </div>
              )}
            </div>

            <div style={{
              padding: "12px",
              background: "#e8f5e9",
              borderRadius: "8px",
              marginBottom: "15px",
              border: "1px solid #c8e6c9"
            }}>
              <p style={{ fontSize: "12px", color: "#2e7d32", margin: 0, fontWeight: "500" }}>
                💡 <strong>Two ways to add:</strong><br />
                1. Enter name → Select type → Click "Add Task"<br />
                2. Click type directly (uses default name)
              </p>
            </div>
            
            <div style={{ display: "grid", gap: "10px" }}>
              {TASK_TYPES.map(taskType => {
                const isSelected = selectedTaskType === taskType.value;
                return (
                  <div
                    key={taskType.value}
                    onClick={() => {
                      // Always select the type first - user can then click "Add Task" button
                      // This ensures task name is always used if provided
                      handleTaskTypeSelect(taskType.value);
                    }}
                    style={{
                      padding: "15px",
                      background: isSelected 
                        ? `linear-gradient(135deg, ${taskType.color} 0%, #13547a 100%)`
                        : `linear-gradient(135deg, ${taskType.color} 0%, ${taskType.color}dd 100%)`,
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.3s",
                      border: isSelected ? "3px solid #13547a" : "2px solid transparent",
                      boxShadow: isSelected ? "0 4px 12px rgba(19, 84, 122, 0.4)" : "0 2px 8px rgba(0,0,0,0.1)",
                      transform: isSelected ? "scale(1.02)" : "scale(1)"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                      <span style={{ fontSize: "24px" }}>{taskType.icon}</span>
                      <strong style={{ color: isSelected ? "#fff" : "#13547a", fontSize: "16px" }}>
                        {taskType.label}
                        {isSelected && " ✓"}
                      </strong>
                    </div>
                    <div style={{ fontSize: "12px", color: isSelected ? "rgba(255,255,255,0.9)" : "#666", marginLeft: "34px" }}>
                      {taskType.description}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "30px", padding: "15px", background: "#f0f8ff", borderRadius: "10px" }}>
              <h4 style={{ marginTop: 0, fontSize: "14px", color: "#13547a" }}>💡 Quick Tips</h4>
              <ul style={{ fontSize: "12px", color: "#666", paddingLeft: "20px", margin: "10px 0", lineHeight: "1.6" }}>
                <li><strong>Add Task:</strong> Enter name → Select type → Click "Add" button</li>
                <li><strong>Quick Add:</strong> Click task type directly (uses default name)</li>
                <li><strong>Connect:</strong> Drag from bottom dot to top dot of another task</li>
                <li><strong>Configure:</strong> Double-click any node to edit</li>
                <li><strong>Delete:</strong> Select and press Delete key</li>
                <li><strong>Schedule:</strong> Use Settings panel to set when DAG runs</li>
              </ul>
            </div>

            {nodes.length > 0 && (
              <div style={{ marginTop: "20px", padding: "15px", background: "#e8f5e9", borderRadius: "10px" }}>
                <h4 style={{ marginTop: 0, fontSize: "14px", color: "#13547a" }}>📊 Current Workflow</h4>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                  <div><strong>{nodes.length}</strong> task{nodes.length !== 1 ? 's' : ''} added</div>
                  <div><strong>{edges.length}</strong> connection{edges.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Canvas Area */}
        <div style={{ flex: 1, position: "relative", background: "#f8f9fa" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={handleNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            onSelectionChange={onSelectionChange}
            defaultEdgeOptions={defaultEdgeOptions}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode={["Delete", "Backspace"]}
            multiSelectionKeyCode={["Meta", "Control"]}
            nodesDraggable
            nodesConnectable
            elementsSelectable
          >
            <Background gap={20} size={1} color="#e0e0e0" />
            <MiniMap 
              nodeColor={(node) => TASK_TYPES.find(t => t.value === node.data?.type)?.color || "#80d0c7"}
              style={{ background: "rgba(255,255,255,0.9)" }}
              pannable
              zoomable
            />
            <Controls style={{ background: "rgba(255,255,255,0.9)" }} showInteractive={false} />
          </ReactFlow>

          {nodes.length === 0 && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "#999"
            }}>
              <div style={{ fontSize: "64px", marginBottom: "20px" }}>🎨</div>
              <h3 style={{ color: "#13547a", marginBottom: "10px" }}>Start Building Your Workflow</h3>
              <p>Click tasks from the palette to add them to your canvas</p>
            </div>
          )}

          {error && (
            <div style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#ffebee",
              color: "#c62828",
              padding: "12px 20px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              zIndex: 1000
            }}>
              {error}
            </div>
          )}
        </div>

        {/* DAG Settings Panel - Slide in/out */}
        {showDagSettings && (
          <div style={{
            width: "350px",
            background: "rgba(255, 255, 255, 0.98)",
            borderLeft: "2px solid #80d0c7",
            padding: "20px",
            overflowY: "auto",
            boxShadow: "-2px 0 10px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#13547a" }}>⚙️ DAG Settings</h3>
              <button
                onClick={() => setShowDagSettings(false)}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666" }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#13547a", fontWeight: "600" }}>
                Description
              </label>
              <textarea
                placeholder="Describe what this DAG does..."
                value={dagDescription}
                onChange={(e) => setDagDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #80d0c7",
                  borderRadius: "8px",
                  minHeight: "80px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", marginBottom: "10px", color: "#13547a", fontWeight: "600" }}>
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                  style={{ marginRight: "8px", width: "18px", height: "18px" }}
                />
                Enable Automatic Scheduling
              </label>
              <p style={{ fontSize: "12px", color: "#666", marginLeft: "26px", marginTop: "5px" }}>
                Schedule when this DAG should run automatically
              </p>
            </div>

            {schedule.enabled && (
              <div style={{ padding: "15px", background: "#f0f8ff", borderRadius: "10px", marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "#13547a", fontWeight: "600" }}>
                  Schedule Type
                </label>
                <select
                  value={schedule.type}
                  onChange={(e) => setSchedule({ ...schedule, type: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "2px solid #80d0c7",
                    borderRadius: "8px",
                    fontSize: "14px",
                    marginBottom: "15px"
                  }}
                >
                  <option value="manual">Manual Only</option>
                  <option value="cron">Cron Expression</option>
                  <option value="interval">Interval (Every N seconds)</option>
                </select>

                {schedule.type === "cron" && (
                  <>
                    <label style={{ display: "block", marginBottom: "8px", color: "#13547a", fontWeight: "600" }}>
                      Cron Expression
                    </label>
                    <input
                      placeholder="0 9 * * * (Daily at 9 AM)"
                      value={schedule.cronExpression}
                      onChange={(e) => setSchedule({ ...schedule, cronExpression: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "2px solid #80d0c7",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontFamily: "monospace",
                        marginBottom: "10px"
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#666" }}>
                      <strong>Examples:</strong><br />
                      <code>0 9 * * *</code> - Daily at 9 AM<br />
                      <code>*/5 * * * *</code> - Every 5 minutes<br />
                      <code>0 0 * * 1</code> - Every Monday at midnight
                    </div>
                  </>
                )}

                {schedule.type === "interval" && (
                  <>
                    <label style={{ display: "block", marginBottom: "8px", color: "#13547a", fontWeight: "600" }}>
                      Interval (seconds)
                    </label>
                    <input
                      type="number"
                      placeholder="60"
                      value={schedule.intervalSeconds}
                      onChange={(e) => setSchedule({ ...schedule, intervalSeconds: parseInt(e.target.value) || 60 })}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "2px solid #80d0c7",
                        borderRadius: "8px",
                        fontSize: "14px"
                      }}
                    />
                  </>
                )}
              </div>
            )}

            <div style={{ padding: "15px", background: "#fff3e0", borderRadius: "10px" }}>
              <h4 style={{ marginTop: 0, fontSize: "14px", color: "#13547a" }}>📊 DAG Stats</h4>
              <div style={{ fontSize: "13px", color: "#666" }}>
                <div style={{ marginBottom: "8px" }}>
                  <strong>Tasks:</strong> {nodes.length}
                </div>
                <div style={{ marginBottom: "8px" }}>
                  <strong>Connections:</strong> {edges.length}
                </div>
                <div>
                  <strong>Status:</strong> {dagId ? "Saved" : "New"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop to close panel when clicking outside */}
      {selectedNode && (
        <div
          onClick={(e) => {
            // Only close if clicking the backdrop, not the panel
            if (e.target === e.currentTarget) {
              setSelectedNode(null);
            }
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.3)",
            zIndex: 999,
            cursor: "pointer"
          }}
        />
      )}

      {/* Task Configuration Panel */}
      {selectedNode && nodes.some(n => n.id === selectedNode.id) && (
        <TaskConfigPanel
          key={`config-${selectedNode.id}`} // Stable key based on node ID only
          node={selectedNode} // Use selectedNode directly to prevent re-fetching
          onUpdate={handleNodeUpdate}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
