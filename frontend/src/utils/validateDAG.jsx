export const hasCycle = (nodes, edges) => {
  const adj = {};
  nodes.forEach(n => (adj[n.id] = []));
  edges.forEach(e => adj[e.source].push(e.target));

  const visited = {};
  const recStack = {};

  const dfs = (node) => {
    visited[node] = true;
    recStack[node] = true;

    for (const neighbor of adj[node]) {
      if (!visited[neighbor] && dfs(neighbor)) return true;
      else if (recStack[neighbor]) return true;
    }
    recStack[node] = false;
    return false;
  };

  for (const n of nodes.map(n => n.id)) {
    if (!visited[n] && dfs(n)) return true;
  }
  return false;
};
