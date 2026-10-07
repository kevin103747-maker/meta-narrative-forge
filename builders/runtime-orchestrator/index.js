import { validate } from '../schema-factory/index.js';
import { SimulationTick } from './simulation-tick.js';
import { ContextAssembler } from './context-assembler.js';

export class RuntimeOrchestrator {
  /**
   * @param {object} params
   * @param {object} [params.worldGraph] - WorldGraphBuilder 인스턴스
   * @param {object} [params.logicCompiler] - NarrativeLogicCompiler 인스턴스
   */
  constructor({ worldGraph = null, logicCompiler = null } = {}) {
    this.worldGraph = worldGraph;
    this.logicCompiler = logicCompiler;
    this.characters = new Map();
    this.currentSceneIndex = 0;
    this.elapsedHoursTotal = 0;
    this.historySnapshots = [];
  }

  /**
   * 인물 등록 (schema-factory로 검증)
   */
  registerCharacter(characterData) {
    const check = validate('character', characterData);
    if (!check.valid) {
      throw new Error(`[RuntimeOrchestrator] 유효하지 않은 인물 데이터: ${check.errors.join(', ')}`);
    }
    if (this.characters.has(characterData.id)) {
      throw new Error(`[RuntimeOrchestrator] 이미 등록된 인물 ID: '${characterData.id}'`);
    }
    this.characters.set(characterData.id, JSON.parse(JSON.stringify(characterData)));
  }

  /**
   * 롤백을 위한 현재 상태 스냅샷 저장
   */
  saveSnapshot() {
    const snapshot = {
      sceneIndex: this.currentSceneIndex,
      elapsedHours: this.elapsedHoursTotal,
      characters: JSON.stringify(Array.from(this.characters.entries())),
      compilerState: this.logicCompiler ? JSON.stringify(this.logicCompiler.exportState()) : null
    };
    this.historySnapshots.push(snapshot);
  }

  /**
   * 이전 상태로 롤백
   */
  rollback() {
    if (this.historySnapshots.length === 0) {
      throw new Error('[RuntimeOrchestrator] 롤백할 이전 스냅샷이 없습니다.');
    }
    const prev = this.historySnapshots.pop();
    this.currentSceneIndex = prev.sceneIndex;
    this.elapsedHoursTotal = prev.elapsedHours;
    this.characters = new Map(JSON.parse(prev.characters));
    return { sceneIndex: this.currentSceneIndex, restored: true };
  }

  /**
   * 씬 1틱 전진 및 상태 갱신
   * @param {object} params
   * @param {number} [params.elapsedHours=3] - 이번 씬에서 경과한 시간
   * @param {string[]} [params.mentionedForeshadowIds=[]] - 본문에 노출된 복선 ID들
   * @param {object} [params.delta={}] - 물리/심리/위치 변동 내역
   */
  stepTick({ elapsedHours = 3, mentionedForeshadowIds = [], delta = {} } = {}) {
    this.saveSnapshot(); // 전진 전 스냅샷 확보

    this.currentSceneIndex += 1;
    this.elapsedHoursTotal += elapsedHours;

    // 1. 생체 주기 연산
    SimulationTick.processBiologicalTick(this.characters, elapsedHours);

    // 2. 씬 델타 반영
    SimulationTick.applyDelta(this.characters, delta);

    // 3. 복선 라이프사이클 갱신
    if (this.logicCompiler) {
      this.logicCompiler.tickScene(mentionedForeshadowIds);
    }

    return {
      currentSceneIndex: this.currentSceneIndex,
      elapsedHoursTotal: this.elapsedHoursTotal
    };
  }

  /**
   * 다음 씬 집필용 최소 컨텍스트 패킷 조립
   */
  assemblePromptContext({ involvedCharacterIds, locationId }) {
    return ContextAssembler.assemble({
      characters: this.characters,
      worldGraph: this.worldGraph,
      logicCompiler: this.logicCompiler,
      involvedCharacterIds,
      locationId,
      currentSceneIndex: this.currentSceneIndex + 1
    });
  }

  getCharacter(id) {
    return this.characters.get(id) || null;
  }
}

export { SimulationTick, ContextAssembler };
