const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_TEXT = 120;
const SEAL_TYPES = ['scene_at_least', 'location', 'present', 'foreshadow_status'];
const FORESHADOW_STATUSES = ['planted', 'dormant', 'triggered', 'resolved'];

export function assertId(label, value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(`[TruthLedger] ${label} 형식 오류: '${value}' (소문자 snake_case 만 허용)`);
  }
}

export function assertText(label, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`[TruthLedger] ${label} 는 비어 있지 않은 문자열이어야 합니다.`);
  }
  if (/[\r\n]/.test(value)) {
    throw new TypeError(`[TruthLedger] ${label} 에 줄바꿈 문자를 넣을 수 없습니다.`);
  }
  if ([...value].length > MAX_TEXT) {
    throw new RangeError(`[TruthLedger] ${label} 는 ${MAX_TEXT}자 이하여야 합니다.`);
  }
}

function validateCondition(cond, i) {
  const tag = `seal.all[${i}]`;
  if (!cond || typeof cond !== 'object' || !SEAL_TYPES.includes(cond.type)) {
    throw new TypeError(`[TruthLedger] ${tag}.type 은 ${SEAL_TYPES.join('|')} 중 하나여야 합니다.`);
  }
  switch (cond.type) {
    case 'scene_at_least':
      if (!Number.isInteger(cond.value) || cond.value < 1) {
        throw new RangeError(`[TruthLedger] ${tag}.value 는 1 이상의 정수여야 합니다.`);
      }
      break;
    case 'location':
      assertId(`${tag}.value`, cond.value);
      break;
    case 'present':
      if (!Array.isArray(cond.value) || cond.value.length === 0) {
        throw new TypeError(`[TruthLedger] ${tag}.value 는 인물 ID 배열이어야 합니다.`);
      }
      cond.value.forEach((id, j) => assertId(`${tag}.value[${j}]`, id));
      break;
    case 'foreshadow_status':
      assertId(`${tag}.id`, cond.id);
      if (!Array.isArray(cond.statuses) || cond.statuses.length === 0 ||
          !cond.statuses.every(s => FORESHADOW_STATUSES.includes(s))) {
        throw new TypeError(`[TruthLedger] ${tag}.statuses 는 ${FORESHADOW_STATUSES.join('|')} 의 배열이어야 합니다.`);
      }
      break;
  }
}

export class FactRegistry {
  constructor() {
    this.facts = new Map();
  }

  register(fact) {
    if (!fact || typeof fact !== 'object') throw new TypeError('[TruthLedger] fact 는 객체여야 합니다.');
    assertId('fact.id', fact.id);
    if (this.facts.has(fact.id)) throw new Error(`[TruthLedger] 이미 등록된 fact 입니다: '${fact.id}'`);
    assertText(`fact '${fact.id}' truth`, fact.truth);
    if (!Array.isArray(fact.rumor_variants) || fact.rumor_variants.length === 0) {
      throw new TypeError(`[TruthLedger] fact '${fact.id}' rumor_variants 는 1개 이상의 문자열 배열이어야 합니다.`);
    }
    fact.rumor_variants.forEach((v, i) => assertText(`fact '${fact.id}' rumor_variants[${i}]`, v));

    let seal = null;
    if (fact.seal !== undefined && fact.seal !== null) {
      if (typeof fact.seal !== 'object' || !Array.isArray(fact.seal.all) || fact.seal.all.length === 0) {
        throw new TypeError(`[TruthLedger] fact '${fact.id}' seal 은 { all: [조건, ...] } 형식이어야 합니다.`);
      }
      fact.seal.all.forEach(validateCondition);
      seal = structuredClone(fact.seal);
    }

    this.facts.set(fact.id, {
      id: fact.id,
      truth: fact.truth,
      rumor_variants: [...fact.rumor_variants],
      seal,
      unsealed_scene: null
    });
  }

  get(id) {
    return this.facts.get(id) || null;
  }

  require(id) {
    const fact = this.get(id);
    if (!fact) throw new Error(`[TruthLedger] 등록되지 않은 fact: '${id}'`);
    return fact;
  }

  list() {
    return [...this.facts.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}
