export function calculateShortestPath(nodes, startNodeId, endNodeId) {
  if (!nodes.has(startNodeId) || !nodes.has(endNodeId)) {
    return { path: [], totalHours: Infinity, maxDanger: 0, possible: false };
  }
  if (startNodeId === endNodeId) {
    return { path: [startNodeId], totalHours: 0, maxDanger: 0, possible: true };
  }
  const distances = new Map();
  const previous = new Map();
  const maxDangers = new Map();
  const unvisited = new Set();

  for (const nodeId of nodes.keys()) {
    distances.set(nodeId, Infinity);
    maxDangers.set(nodeId, 0);
    unvisited.add(nodeId);
  }
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let current = null;
    let shortestDist = Infinity;
    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId);
      if (dist < shortestDist) {
        shortestDist = dist;
        current = nodeId;
      }
    }
    if (current === null || shortestDist === Infinity) break;
    if (current === endNodeId) break;

    unvisited.delete(current);
    const currentNode = nodes.get(current);

    if (currentNode && currentNode.connected_edges) {
      for (const edge of currentNode.connected_edges) {
        const neighborId = edge.target_node_id;
        if (!unvisited.has(neighborId)) continue;
        const newDist = distances.get(current) + edge.travel_cost_hours;
        if (newDist < distances.get(neighborId)) {
          distances.set(neighborId, newDist);
          previous.set(neighborId, current);
          const edgeDanger = edge.danger_level || 1;
          maxDangers.set(neighborId, Math.max(maxDangers.get(current), edgeDanger));
        }
      }
    }
  }

  if (distances.get(endNodeId) === Infinity) {
    return { path: [], totalHours: Infinity, maxDanger: 0, possible: false };
  }
  const path = [];
  let curr = endNodeId;
  while (curr) {
    path.unshift(curr);
    curr = previous.get(curr);
  }
  return {
    path,
    totalHours: distances.get(endNodeId),
    maxDanger: maxDangers.get(endNodeId),
    possible: true
  };
}
