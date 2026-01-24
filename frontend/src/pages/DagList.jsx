import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDags, deleteDag, executeDag } from "../api/dagApi";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function DagList() {
  const [dags, setDags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDags();
    const interval = setInterval(fetchDags, 15000); // Reduced to 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDags = async () => {
    try {
      const res = await getDags();
      setDags(res.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching DAGs:", error);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this DAG?")) return;
    
    try {
      await deleteDag(id);
      fetchDags();
    } catch (error) {
      alert("Error deleting DAG: " + error.message);
    }
  };

  const handleExecute = async (id) => {
    try {
      await executeDag(id);
      alert("DAG execution started!");
    } catch (error) {
      alert("Error starting execution: " + error.message);
    }
  };

  const filteredDags = dags.filter(dag =>
    dag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dag.description && dag.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="section-padding">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1>DAG List</h1>
          <Link to="/builder" className="custom-btn">Create New DAG</Link>
        </div>

        <div style={{ marginBottom: "2rem", maxWidth: "420px" }}>
          <label
            htmlFor="dag-search"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#e5e7eb",
              fontSize: "13px",
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}
          >
            Search DAGs
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "999px",
              background: "rgba(15,23,42,0.92)",
              border: "1px solid rgba(55,65,81,0.9)",
              boxShadow: "0 16px 40px rgba(2,6,23,0.85)"
            }}
          >
            <span style={{ color: "#64748b", fontSize: "18px" }}>🔍</span>
            <input
              id="dag-search"
              type="text"
              placeholder="Search DAGs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e5e7eb",
                fontSize: "14px",
                letterSpacing: "0.02em"
              }}
            />
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : filteredDags.length === 0 ? (
          <div className="card">
            <p>No DAGs found. <Link to="/builder">Create your first DAG</Link></p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "20px" }}>
            {filteredDags.map((dag) => (
              <div key={dag._id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: "10px", color: "var(--primary-color)" }}>
                      {dag.name}
                    </h3>
                    {dag.description && (
                      <p style={{ marginBottom: "15px", color: "var(--p-color)" }}>
                        {dag.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "15px" }}>
                      <span style={{ fontSize: "14px", color: "var(--p-color)" }}>
                        Nodes: {dag.graph?.nodes?.length || 0}
                      </span>
                      <span style={{ fontSize: "14px", color: "var(--p-color)" }}>
                        Edges: {dag.graph?.edges?.length || 0}
                      </span>
                      <span style={{ fontSize: "14px", color: "var(--p-color)" }}>
                        Created: {new Date(dag.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                    <Link
                      to={`/builder?dagId=${dag._id}`}
                      className="custom-btn"
                      style={{ padding: "8px 16px", fontSize: "14px", textAlign: "center" }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleExecute(dag._id)}
                      className="custom-btn"
                      style={{ padding: "8px 16px", fontSize: "14px" }}
                    >
                      Execute
                    </button>
                    <button
                      onClick={() => handleDelete(dag._id)}
                      className="custom-border-btn"
                      style={{ 
                        padding: "8px 16px", 
                        fontSize: "14px",
                        borderColor: "#ef4444",
                        color: "#ef4444"
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
