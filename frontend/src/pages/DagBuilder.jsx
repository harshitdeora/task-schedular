import React, { useCallback, useEffect, useState, useRef } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { hasCycle } from "../utils/validateDAG";
import TaskNode from "../components/TaskNode";
import TaskConfigPanel from "../components/TaskConfigPanel";
import { createDag, getDagById, updateDag } from "../api/dagApi";
import { v4 as uuidv4 } from "uuid";
import { useSearchParams } from "react-router-dom";

const nodeTypes = { taskNode: TaskNode };

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.Arrow },
  style: { stroke: "#3b82f6", strokeWidth: 2 },
};

const TASK_TYPES = [
  { value: "http", label: "HTTP Request", icon: "🌐", color: "#b3e5fc", description: "Call APIs" },
  { value: "email", label: "Send Email", icon: "📧", color: "#ffccbc", description: "Send emails" },
  { value: "database", label: "Database Query", icon: "🗄️", color: "#c8e6c9", description: "Query databases" },
  { value: "script", label: "Script Execution", icon: "📜", color: "#fff9c4", description: "Execute scripts" },
  { value: "file", label: "File Operation", icon: "📁", color: "#e1bee7", description: "File operations" },
  { value: "webhook", label: "Webhook", icon: "🔗", color: "#b2dfdb", description: "Send webhooks" },
  { value: "delay", label: "Delay/Wait", icon: "⏱️", color: "#ffcc80", description: "Wait duration" },
  { value: "notification", label: "Notification", icon: "🔔", color: "#ffcdd2", description: "Send notifications" },
  { value: "transform", label: "Data Transform", icon: "🔄", color: "#c5cae9", description: "Transform data" },
  { value: "condition", label: "Condition", icon: "🔀", color: "#f8bbd0", description: "Conditional logic" },
  { value: "ai_logic", label: "AI Smart-Logic", icon: "🤖", color: "#b39ddb", description: "AI with prompts" },
  { value: "pdf_gen", label: "PDF Generator", icon: "📄", color: "#90caf9", description: "Generate PDFs" },
  { value: "json_filter", label: "JSON Parser", icon: "🔍", color: "#a5d6a7", description: "Parse JSON" },
  { value: "image_proc", label: "Image Processor", icon: "🖼️", color: "#ce93d8", description: "Process images" },
  { value: "html_to_md", label: "HTML to Markdown", icon: "📝", color: "#ffccbc", description: "Convert HTML" },
  { value: "pause", label: "Wait for Signal", icon: "⏸️", color: "#ffab91", description: "Pause execution" }
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
    
    // Check if edge already exists (considering sourceHandle for failure paths)
    const existingEdge = edges.find(e => 
      e.source === params.source && 
      e.target === params.target &&
      (e.sourceHandle === params.sourceHandle || (!e.sourceHandle && !params.sourceHandle))
    );
    if (existingEdge) {
      setError("Edge already exists.");
      return;
    }
    
    const tempEdges = [...edges, { source: params.source, target: params.target, sourceHandle: params.sourceHandle }];
    if (hasCycle(nodes, tempEdges)) {
      setError("❌ Cycle detected! DAG must be acyclic.");
      return;
    }
    setError("");
    
    // Determine edge type and color based on sourceHandle
    const isFailurePath = params.sourceHandle === "failure";
    const edgeWithArrow = {
      ...params,
      id: params.id || uuidv4(),
      type: isFailurePath ? "failure" : "success",
      sourceHandle: params.sourceHandle || "source",
      markerEnd: { type: MarkerType.Arrow },
      style: { 
        stroke: isFailurePath ? "#ef4444" : "#3b82f6", 
        strokeWidth: 2 
      },
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

      const flowEdges = dag.graph.edges.map(e => {
        const isFailure = e.type === "failure" || e.sourceHandle === "failure";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type || (isFailure ? "failure" : "success"),
          sourceHandle: e.sourceHandle || (isFailure ? "failure" : "source"),
          targetHandle: e.targetHandle,
          markerEnd: { type: MarkerType.Arrow },
          style: { 
            stroke: isFailure ? "#ef4444" : "#3b82f6", 
            strokeWidth: 2 
          },
        };
      });

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

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 100 });

    nodes.forEach((node) => {
      g.setNode(node.id, { width: 200, height: 100 });
    });

    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 100,
          y: nodeWithPosition.y - 50,
        },
      };
    });

    setNodes(layoutedNodes);
  }, [nodes, edges, setNodes]);

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
        type: e.type || (e.sourceHandle === "failure" ? "failure" : "success"),
        sourceHandle: e.sourceHandle || (e.type === "failure" ? "failure" : "source"),
        targetHandle: e.targetHandle
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
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(circle at 0 0, rgba(37,99,235,0.26), transparent 60%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.20), transparent 60%), #020617",
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          background: "rgba(15,23,42,0.96)",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 18px 45px rgba(15,23,42,0.98)",
          zIndex: 10,
          borderBottom: "1px solid rgba(31,41,55,0.95)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h2 style={{ margin: 0, color: "#e5e7eb", fontSize: "20px" }}>🎨 DAG Builder</h2>
          <input
            placeholder="Enter DAG name..."
            value={dagName}
            onChange={(e) => setDagName(e.target.value)}
            style={{
              padding: "8px 14px",
              border: "1px solid rgba(55,65,81,0.9)",
              borderRadius: "999px",
              fontSize: "13px",
              minWidth: "260px",
              outline: "none",
              backgroundColor: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              boxShadow: "0 10px 30px rgba(15,23,42,0.9)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowTaskPalette(!showTaskPalette)}
            className="custom-btn"
            style={{ padding: "8px 20px", fontSize: "13px" }}
          >
            {showTaskPalette ? "📋 Hide" : "📋 Show"} Tasks
          </button>
          <button
            onClick={() => setShowDagSettings(!showDagSettings)}
            className="custom-border-btn"
            style={{ padding: "8px 20px", fontSize: "13px" }}
          >
            ⚙️ Settings
          </button>
          <button
            onClick={handleAutoLayout}
            className="custom-border-btn"
            style={{ padding: "8px 20px", fontSize: "13px" }}
            title="Auto-organize nodes"
          >
            📐 Auto-Tidy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="custom-btn"
            style={{ padding: "8px 25px", fontSize: "13px", background: "#1d4ed8" }}
          >
            {saving ? "💾 Saving..." : dagId ? "💾 Update" : "💾 Save DAG"}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Task Palette - Slide in/out */}
        {showTaskPalette && (
          <div
            style={{
              width: "360px",
              background: "rgba(15,23,42,0.96)",
              borderRight: "1px solid rgba(31,41,55,0.95)",
              padding: "20px",
              overflowY: "auto",
              boxShadow: "18px 0 45px rgba(15,23,42,0.98)",
              transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#e5e7eb",
                fontSize: "16px",
                marginBottom: "15px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              🎯 Task Library
            </h3>

            {/* Task Name Input Section */}
            <div
              style={{
                padding: "16px",
                background:
                  "radial-gradient(circle at 0 0, rgba(37,99,235,0.28), transparent 60%)",
                borderRadius: "12px",
                marginBottom: "18px",
                border: "1px solid rgba(37,99,235,0.75)",
                boxShadow: "0 18px 45px rgba(15,23,42,0.96)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>📝</span>
                <label
                  style={{
                    color: "#e5e7eb",
                    fontWeight: 600,
                    fontSize: "13px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Task Name
                </label>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginLeft: "auto",
                  }}
                >
                  (Optional)
                </span>
              </div>
              <input
                type="text"
                value={taskNameInput}
                onChange={(e) => setTaskNameInput(e.target.value)}
                placeholder="Enter task name (e.g. Fetch User Data, Send Report Email)"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid rgba(55,65,81,0.9)",
                  borderRadius: "10px",
                  fontSize: "13px",
                  marginBottom: "10px",
                  outline: "none",
                  transition:
                    "border-color 0.2s ease-out, box-shadow 0.2s ease-out, background-color 0.2s ease-out",
                  backgroundColor: "rgba(15,23,42,0.98)",
                  color: "#e5e7eb",
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
                    padding: "10px 12px",
                    fontSize: "13px",
                    background: "#1d4ed8",
                    fontWeight: 600,
                  }}
                >
                  ➕ Add Task: "{taskNameInput.trim() || TASK_TYPES.find(t => t.value === selectedTaskType)?.label || 'Unnamed Task'}"
                </button>
              ) : (
                <div
                  style={{
                    padding: "10px",
                    background: "rgba(15,23,42,0.9)",
                    borderRadius: "8px",
                    textAlign: "center",
                    border: "1px dashed rgba(75,85,99,0.9)",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      margin: 0,
                    }}
                  >
                    👇 Select a task type below first
                  </p>
                </div>
              )}
            </div>

            <div
              style={{
                padding: "10px 12px",
                background: "rgba(15,23,42,0.9)",
                borderRadius: "10px",
                marginBottom: "14px",
                border: "1px solid rgba(55,65,81,0.9)",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  margin: 0,
                  fontWeight: 500,
                }}
              >
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
                      padding: "12px 14px",
                      background: isSelected
                        ? "radial-gradient(circle at 0 0, rgba(37,99,235,0.9), rgba(15,23,42,0.98))"
                        : "rgba(15,23,42,0.96)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition:
                        "transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out, background-color 0.2s ease-out",
                      border: isSelected
                        ? "1px solid rgba(129,140,248,0.9)"
                        : "1px solid rgba(31,41,55,0.95)",
                      boxShadow: isSelected
                        ? "0 20px 45px rgba(15,23,42,0.98), 0 0 0 1px rgba(59,130,246,0.75)"
                        : "0 16px 40px rgba(15,23,42,0.96)",
                      transform: isSelected ? "scale(1.02)" : "scale(1)",
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "4px",
                      }}
                    >
                      <span style={{ fontSize: "20px" }}>{taskType.icon}</span>
                      <strong
                        style={{
                          color: isSelected ? "#e5e7eb" : "#e5e7eb",
                          fontSize: "14px",
                        }}
                      >
                        {taskType.label}
                        {isSelected && " ✓"}
                      </strong>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: isSelected
                          ? "rgba(226,232,240,0.95)"
                          : "#9ca3af",
                        marginLeft: "34px",
                      }}
                    >
                      {taskType.description}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: "22px",
                padding: "14px",
                background: "rgba(15,23,42,0.96)",
                borderRadius: "10px",
                border: "1px solid rgba(31,41,55,0.95)",
              }}
            >
              <h4
                style={{
                  marginTop: 0,
                  fontSize: "13px",
                  color: "#e5e7eb",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                💡 Quick Tips
              </h4>
              <ul
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  paddingLeft: "20px",
                  margin: "10px 0",
                  lineHeight: "1.6",
                }}
              >
                <li><strong>Add Task:</strong> Enter name → Select type → Click "Add" button</li>
                <li><strong>Quick Add:</strong> Click task type directly (uses default name)</li>
                <li><strong>Connect:</strong> Drag from bottom dot to top dot of another task</li>
                <li><strong>Configure:</strong> Double-click any node to edit</li>
                <li><strong>Delete:</strong> Select and press Delete key</li>
                <li><strong>Schedule:</strong> Use Settings panel to set when DAG runs</li>
              </ul>
            </div>

            {nodes.length > 0 && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "14px",
                  background: "rgba(15,23,42,0.96)",
                  borderRadius: "10px",
                  border: "1px solid rgba(31,41,55,0.95)",
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    fontSize: "13px",
                    color: "#e5e7eb",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  📊 Current Workflow
                </h4>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9ca3af",
                    marginTop: "6px",
                  }}
                >
                  <div><strong>{nodes.length}</strong> task{nodes.length !== 1 ? 's' : ''} added</div>
                  <div><strong>{edges.length}</strong> connection{edges.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Canvas Area */}
        <div
          style={{
            flex: 1,
            position: "relative",
            background: "#020617",
          }}
        >
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
            <Background gap={24} size={0.7} color="#1f2937" />
            <MiniMap 
              nodeColor={(node) => TASK_TYPES.find(t => t.value === node.data?.type)?.color || "#3b82f6"}
              style={{ background: "rgba(15,23,42,0.96)", borderRadius: 8 }}
              pannable
              zoomable
            />
            <Controls
              style={{
                background: "rgba(15,23,42,0.96)",
                borderRadius: 8,
                border: "1px solid rgba(31,41,55,0.9)",
              }}
              showInteractive={false}
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎨</div>
              <h3
                style={{
                  color: "#e5e7eb",
                  marginBottom: "8px",
                  fontSize: "20px",
                }}
              >
                Start Building Your Workflow
              </h3>
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                Click tasks from the palette to add them to your canvas
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(127,29,29,0.96)",
                color: "#fee2e2",
                padding: "10px 18px",
                borderRadius: "999px",
                boxShadow: "0 18px 40px rgba(15,23,42,0.96)",
                zIndex: 1000,
                border: "1px solid rgba(248,113,113,0.7)",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* DAG Settings Panel - Slide in/out */}
        {showDagSettings && (
          <div
            style={{
              width: "360px",
              background: "rgba(15,23,42,0.96)",
              borderLeft: "1px solid rgba(31,41,55,0.95)",
              padding: "20px",
              overflowY: "auto",
              boxShadow: "-18px 0 45px rgba(15,23,42,0.98)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#e5e7eb",
                  fontSize: "16px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                ⚙️ DAG Settings
              </h3>
              <button
                onClick={() => setShowDagSettings(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "22px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#e5e7eb",
                  fontWeight: 600,
                  fontSize: "13px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Description
              </label>
              <textarea
                placeholder="Describe what this DAG does..."
                value={dagDescription}
                onChange={(e) => setDagDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid rgba(55,65,81,0.9)",
                  borderRadius: "10px",
                  minHeight: "80px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  backgroundColor: "rgba(15,23,42,0.98)",
                  color: "#e5e7eb",
                }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "8px",
                  color: "#e5e7eb",
                  fontWeight: 600,
                  fontSize: "13px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                  style={{
                    marginRight: "8px",
                    width: "16px",
                    height: "16px",
                  }}
                />
                Enable Automatic Scheduling
              </label>
              <p
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginLeft: "24px",
                  marginTop: "4px",
                }}
              >
                Schedule when this DAG should run automatically
              </p>
            </div>

            {schedule.enabled && (
              <div
                style={{
                  padding: "14px",
                  background: "rgba(15,23,42,0.96)",
                  borderRadius: "10px",
                  marginBottom: "18px",
                  border: "1px solid rgba(31,41,55,0.95)",
                }}
              >
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#e5e7eb",
                    fontWeight: 600,
                    fontSize: "13px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Schedule Type
                </label>
                <select
                  value={schedule.type}
                  onChange={(e) => setSchedule({ ...schedule, type: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid rgba(55,65,81,0.9)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    marginBottom: "12px",
                    backgroundColor: "rgba(15,23,42,0.98)",
                    color: "#e5e7eb",
                  }}
                >
                  <option value="manual">Manual Only</option>
                  <option value="cron">Cron Expression</option>
                  <option value="interval">Interval (Every N seconds)</option>
                </select>

                {schedule.type === "cron" && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "6px",
                        color: "#e5e7eb",
                        fontWeight: 600,
                        fontSize: "13px",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Cron Expression
                    </label>
                    <input
                      placeholder="0 9 * * * (Daily at 9 AM)"
                      value={schedule.cronExpression}
                      onChange={(e) => setSchedule({ ...schedule, cronExpression: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid rgba(55,65,81,0.9)",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        marginBottom: "8px",
                        backgroundColor: "rgba(15,23,42,0.98)",
                        color: "#e5e7eb",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                      <strong>Examples:</strong><br />
                      <code>0 9 * * *</code> - Daily at 9 AM<br />
                      <code>*/5 * * * *</code> - Every 5 minutes<br />
                      <code>0 0 * * 1</code> - Every Monday at midnight
                    </div>
                  </>
                )}

                {schedule.type === "interval" && (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "6px",
                        color: "#e5e7eb",
                        fontWeight: 600,
                        fontSize: "13px",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Interval (seconds)
                    </label>
                    <input
                      type="number"
                      placeholder="60"
                      value={schedule.intervalSeconds}
                      onChange={(e) => setSchedule({ ...schedule, intervalSeconds: parseInt(e.target.value) || 60 })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid rgba(55,65,81,0.9)",
                        borderRadius: "10px",
                        fontSize: "13px",
                        backgroundColor: "rgba(15,23,42,0.98)",
                        color: "#e5e7eb",
                      }}
                    />
                  </>
                )}
              </div>
            )}

            <div
              style={{
                padding: "14px",
                background: "rgba(15,23,42,0.96)",
                borderRadius: "10px",
                border: "1px solid rgba(31,41,55,0.95)",
              }}
            >
              <h4
                style={{
                  marginTop: 0,
                  fontSize: "13px",
                  color: "#e5e7eb",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                📊 DAG Stats
              </h4>
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
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
