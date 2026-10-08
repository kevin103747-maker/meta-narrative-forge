import { FactRegistry } from './fact-registry.js';
import { BeliefPropagator } from './belief-propagator.js';
import { SealEvaluator } from './seal-evaluator.js';

const SOURCE_LABELS = { witness: '목격', told: '전언', rumor: '소문', revealed: '확인' };
const PLANTABLE_SOURCES = ['witness', 'told'];

export class TruthLedger {
  constructor({ worldGraph = null, logicCompiler = null } = {}) {
    this.worldGraph = worldGraph;
    this.logicCompiler = logicCompiler;
    this.registry = new FactRegistry();
    this.propagator = new BeliefPropagator(this.registry);
  }

  registerFact(fact) {
    this.registry.register(fact);
  }

  isSealed(factId) {
    const fact = this.registry.require(factId);
    return fact.seal !== null && fact.unsealed_scene === null;
  }

  // 작가가 직접 심는 믿음 (witness|told). 봉인된 진실은 unseal 전에 심을 수 없다
  plantBelief(characterId, { fact_id, version, confidence, source, scene } = {}) {
    const fact = this.registry.require(fact_id);
    if (!PLANTABLE_SOURCES.includes(source)) {
      throw new TypeError('[TruthLedger] source 는 witness|told 만 직접 심을 수 있습니다 (rumor 는 hearRumors, revealed 는 unseal).');
    }
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
      throw new RangeError('[TruthLedger] confidence 는 0~100 정수여야 합니다.');
    }
    if (!Number.isInteger(scene) || scene < 0) {
      throw new RangeError('[TruthLedger] scene 은 0 이상의 정수여야 합니다.');
    }
    let content;
    let isTrue;
    if (version === 'truth') {
      if (this.isSealed(fact_id)) {
        throw new Error(`[TruthLedger] 봉인된 진실은 unseal 전에 심을 수 없습니다: '${fact_id}'`);
      }
      content = fact.truth;
      isTrue = true;
    } else if (Number.isInteger(version) && version >= 0 && version < fact.rumor_variants.length) {
      content = fact.rumor_variants[version];
      isTrue = false;
    } else {
      throw new RangeError("[TruthLedger] version 은 'truth' 또는 rumor_variants 인덱스여야 합니다.");
    }
    return this.propagator.set(characterId, {
      fact_id, content, is_true: isTrue, confidence, source, acquired_scene: scene
    });
  }

  spreadRumor({ factId, originLocationId, elapsedHours, startVariant = 0 } = {}) {
    return this.propagator.spread({
      worldGraph: this.worldGraph, factId, originLocationId, elapsedHours, startVariant
    });
  }

  hearRumors(characterId, locationId, sceneIndex) {
    return this.propagator.hear(characterId, locationId, sceneIndex);
  }

  // 아직 봉인된 fact 들의 해제 가능 여부 (판정만, 상태 변경 없음)
  evaluateSeals(ctx = {}) {
    return this.registry.list()
      .filter(f => f.seal && f.unsealed_scene === null)
      .map(f => ({ factId: f.id, ...SealEvaluator.evaluate(f.seal, ctx, this.logicCompiler) }));
  }

  // 조건이 코드로 충족됐을 때만 해제, 동석 인물에게 진실(확신 100) 부여
  unseal(factId, { sceneIndex, locationId, presentCharacterIds = [] } = {}) {
    const fact = this.registry.require(factId);
    if (!fact.seal) throw new Error(`[TruthLedger] 봉인이 없는 fact 입니다: '${factId}'`);
    if (fact.unsealed_scene !== null) {
      throw new Error(`[TruthLedger] 이미 해제된 봉인입니다: '${factId}' (씬 #${fact.unsealed_scene})`);
    }
    if (!Number.isInteger(sceneIndex) || sceneIndex < 1) {
      throw new RangeError('[TruthLedger] sceneIndex 는 1 이상의 정수여야 합니다.');
    }
    const check = SealEvaluator.evaluate(fact.seal, { sceneIndex, locationId, presentCharacterIds }, this.logicCompiler);
    if (!check.satisfied) {
      throw new Error(`[TruthLedger] 봉인 조건 미충족 '${factId}': ${check.unmet.join(' / ')}`);
    }
    fact.unsealed_scene = sceneIndex;
    const revealedTo = [...presentCharacterIds];
    for (const id of revealedTo) {
      this.propagator.set(id, {
        fact_id: factId, content: fact.truth, is_true: true,
        confidence: 100, source: 'revealed', acquired_scene: sceneIndex
      });
    }
    return { factId, revealedTo };
  }

  // 작가용 조회 (is_true 포함). 씬 패킷에는 절대 넣지 않는다
  getBeliefs(characterId) {
    return structuredClone(this.propagator.list(characterId));
  }

  // runtime-orchestrator.registerContextProvider 용 동기 함수
  // 등장 인물이 '믿는 내용'만 출력하고 참/거짓 여부는 내보내지 않는다 (전지적 누수 방지)
  createContextProvider() {
    const ledger = this;
    return function truthLedgerProvider(input) {
      const lines = [];
      for (const c of input.characters) {
        for (const b of ledger.propagator.list(c.id)) {
          lines.push(`${c.name} 믿음: "${b.content}" (확신 ${b.confidence}, ${SOURCE_LABELS[b.source]})`);
        }
      }
      return { lines, data: { beliefCount: lines.length } };
    };
  }
}

export { FactRegistry, BeliefPropagator, SealEvaluator };
