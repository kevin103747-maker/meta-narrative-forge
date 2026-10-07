import { validate } from '../schema-factory/index.js';
import { calculateShortestPath } from './pathfinder.js';

export class WorldGraphBuilder {
  constructor() {
    this.nodes = new Map();
  }

  addLocation(locationData) {
    const check = validate('location', locationData);
    if (!check.valid) {
      throw new Error(`[WorldGraphBuilder] 규격 오류: ${check.errors.join(', ')}`);
    }
    if (this.nodes.has(locationData.id)) {
      throw new Error(`[WorldGraphBuilder] 중복 노드: '${locationData.id}'`);
    }
    this.nodes.set(locationData.id, locationData);
  }

  getLocation(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  findPath(fromId, toId) {
    return calculateShortestPath(this.nodes, fromId, toId);
  }

  exportGraph() {
    return Array.from(this.nodes.values());
  }
}
