import { assertId } from './fact-registry.js';

const RUMOR_BASE_CONFIDENCE = 70;
const RUMOR_DECAY_PER_HOP = 15;
const RUMOR_MIN_CONFIDENCE = 10;

function byKey(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class BeliefPropagator {
  constructor(registry) {
    this.registry = registry;
    this.beliefs = new Map(); // characterId -> Map(factId -> belief)
    this.rumors = new Map();  // locationId  -> Map(factId -> { variant_index, hops, hours })
  }

  // 덮어쓰기 규칙: 기존 믿음이 없거나, revealed 이거나, 확신도가 더 높을 때만 교체
  set(characterId, belief) {
    assertId('characterId', characterId);
    if (!this.beliefs.has(characterId)) this.beliefs.set(characterId, new Map());
    const mine = this.beliefs.get(characterId);
    const prev = mine.get(belief.fact_id);
    if (prev && belief.source !== 'revealed' && belief.confidence <= prev.confidence) return false;
    mine.set(belief.fact_id, belief);
    return true;
  }

  // 그래프 travel_cost_hours 기준 도달 범위 계산, 홉 수만큼 왜곡된 변형본 배치
  spread({ worldGraph, factId, originLocationId, elapsedHours, startVariant = 0 }) {
    if (!worldGraph) throw new Error('[TruthLedger] 소문 전파에는 worldGraph 가 필요합니다.');
    const fact = this.registry.require(factId);
    if (!worldGraph.getLocation(originLocationId)) {
      throw new Error(`[TruthLedger] 존재하지 않는 출발 장소: '${originLocationId}'`);
    }
    if (typeof elapsedHours !== 'number' || !Number.isFinite(elapsedHours) || elapsedHours < 0) {
      throw new RangeError('[TruthLedger] elapsedHours 는 0 이상의 유한한 숫자여야 합니다.');
    }
    if (!Number.isInteger(startVariant) || startVariant < 0 || startVariant >= fact.rumor_variants.length) {
      throw new RangeError('[TruthLedger] startVariant 는 rumor_variants 범위 안의 정수여야 합니다.');
    }

    const last = fact.rumor_variants.length - 1;
    const reached = [];
    for (const loc of worldGraph.exportGraph()) {
      const route = worldGraph.findPath(originLocationId, loc.id);
      if (!route.possible || route.totalHours > elapsedHours) continue;
      const hops = route.path.length - 1;
      const entry = { variant_index: Math.min(startVariant + hops, last), hops, hours: route.totalHours };
      if (!this.rumors.has(loc.id)) this.rumors.set(loc.id, new Map());
      const here = this.rumors.get(loc.id);
      const prev = here.get(factId);
      if (!prev || entry.variant_index < prev.variant_index) here.set(factId, entry);
      reached.push({ locationId: loc.id, ...here.get(factId) });
    }
    return reached;
  }

  // 해당 장소에 도달한 소문을 인물이 듣는다 (확신도는 홉 수에 따라 감쇠)
  hear(characterId, locationId, sceneIndex) {
    assertId('characterId', characterId);
    const here = this.rumors.get(locationId);
    if (!here) return [];
    const learned = [];
    for (const factId of [...here.keys()].sort(byKey)) {
      const r = here.get(factId);
      const fact = this.registry.require(factId);
      const confidence = Math.max(RUMOR_MIN_CONFIDENCE, RUMOR_BASE_CONFIDENCE - RUMOR_DECAY_PER_HOP * r.hops);
      const changed = this.set(characterId, {
        fact_id: factId,
        content: fact.rumor_variants[r.variant_index],
        is_true: false,
        confidence,
        source: 'rumor',
        acquired_scene: sceneIndex
      });
      if (changed) learned.push(factId);
    }
    return learned;
  }

  list(characterId) {
    const mine = this.beliefs.get(characterId);
    if (!mine) return [];
    return [...mine.keys()].sort(byKey).map(k => mine.get(k));
  }
}
