export function topologicalSort(nodes, edges) {
  const indegree = {};
  const adj = {};
  nodes.forEach(n => { indegree[n.id] = 0; adj[n.id] = []; });

  edges.forEach(e => {
    indegree[e.target]++;
    adj[e.source].push(e.target);
  });

  const queue = Object.keys(indegree).filter(k => indegree[k] === 0);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    adj[node].forEach(nei => {
      indegree[nei]--;
      if (indegree[nei] === 0) queue.push(nei);
    });
  }
  return order;
}
