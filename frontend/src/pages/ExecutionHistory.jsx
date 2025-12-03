import React, { useEffect, useState } from "react";
import { getExecutions } from "../api/executionApi";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#00C49F", "#FF8042"];

export default function ExecutionHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    getExecutions().then(res => {
      const success = res.data.filter(x => x.status === "success").length;
      const failed = res.data.filter(x => x.status === "failed").length;
      setData([
        { name: "Success", value: success },
        { name: "Failed", value: failed }
      ]);
    });
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Execution History</h2>
      <PieChart width={400} height={300}>
        <Pie
          dataKey="value"
          data={data}
          cx={200}
          cy={150}
          outerRadius={100}
          fill="#8884d8"
          label
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </div>
  );
}
