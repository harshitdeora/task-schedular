import React, { useEffect, useState } from "react";
import { getDags } from "../api/dagApi";

export default function DagList() {
  const [dags, setDags] = useState([]);

  useEffect(() => {
    getDags().then((res) => setDags(res.data));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>All DAGs</h2>
      <ul>
        {dags.map((d) => (
          <li key={d._id}>{d.name}</li>
        ))}
      </ul>
    </div>
  );
}
