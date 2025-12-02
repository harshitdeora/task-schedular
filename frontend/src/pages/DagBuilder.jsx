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
import { createDag } from "../api/dagApi";
import { v4 as uuidv4 } from "uuid";

const nodeTypes = { taskNode: TaskNode };

// default edge appearance (arrows + stroke)
const defaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.Arrow, // built-in arrow marker
  },
  style: {
    stroke: "#6b7280", // slightly darker gray so it's visible
    strokeWidth: 2
  }
};

export default function DagBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dagName, setDagName] = useState("");
  const [taskNameInput, setTaskNameInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState({ nodes: [], edges: [] });

  // Robust onConnect: adds markerEnd for directed arrow + cycle/duplicate checks
  const onConnect = useCallback((params) => {
    console.log("onConnect called with params:", params);

    // ensure valid completed drop
    if (!params || !params.source || !params.target) {
      console.log("Invalid connect drop - missing source or target. Ignoring.");
      return;
    }

    if (params.source === params.target) {
      setError("Cannot connect a node to itself.");
      return;
    }

    // duplicate guard
    if (edges.some(e => e.source === params.source && e.target === params.target)) {
      setError("Edge already exists between those nodes.");
      return;
    }

    // cycle check (use a temp edges array)
    const tempEdges = [...edges, { source: params.source, target: params.target }];
    if (hasCycle(nodes, tempEdges)) {
      setError("❌ Cycle detected! DAG must be acyclic.");
      return;
    }

    setError("");
    // create the edge object with arrow marker and style
    const edgeWithArrow = {
      ...params,
      id: params.id || uuidv4(),
      markerEnd: { type: MarkerType.Arrow },
      style: { stroke: "#6b7280", strokeWidth: 2 }
    };

    setEdges((eds) => addEdge(edgeWithArrow, eds));
  }, [edges, nodes, setEdges]);

  const addNode = (type) => {
    const id = uuidv4().slice(0, 5);
    const finalName = taskNameInput && taskNameInput.trim() !== "" ? taskNameInput.trim() : `Task ${id}`;

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "taskNode",
        position: { x: Math.random() * 800 + 50, y: Math.random() * 500 + 50 },
        data: { label: finalName, type, config: {} }
      }
    ]);

    setTaskNameInput("");
  };

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
        type: e.type || "success",
        markerEnd: e.markerEnd || { type: MarkerType.Arrow }
      }))
    };

    try {
      await createDag({ name: dagName, graph });
      alert("✅ DAG saved to MongoDB!");
    } catch (err) {
      console.error("Failed to save DAG:", err);
      alert("Failed to save DAG: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // delete key handler
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
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{
        width: 260,
        background: "#f7f7f7",
        borderRight: "1px solid #ccc",
        padding: 16
      }}>
        <h4>Task Types</h4>

        <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Task Name</label>
        <input
          value={taskNameInput}
          onChange={(e) => setTaskNameInput(e.target.value)}
          placeholder="e.g. Fetch API, Send Email"
          style={{ width: "100%", padding: "6px 8px", marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <button onClick={() => addNode("http")}>+ HTTP</button>
          <button onClick={() => addNode("script")}>+ Script</button>
          <button onClick={() => addNode("email")}>+ Email</button>
        </div>

        <hr style={{ margin: "16px 0" }} />

        <h4>DAG Info</h4>
        <input
          placeholder="DAG Name"
          value={dagName}
          onChange={(e) => setDagName(e.target.value)}
          style={{ width: "100%", padding: "6px 8px" }}
        />
        <br /><br />
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "💾 Save DAG"}
        </button>
        {error && <p style={{ color: "red", fontSize: 12 }}>{error}</p>}
        <p style={{ fontSize: 12, color: "#666", marginTop: 12 }}>
          Tip: start dragging from the bottom dot (out) and drop on top dot (in). Select node/edge and press Delete to remove it.
        </p>
      </div>

      <div style={{ flexGrow: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          onSelectionChange={onSelectionChange}
          defaultEdgeOptions={defaultEdgeOptions} // <-- ensures arrows on default edges
        >
          <Background gap={16} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
