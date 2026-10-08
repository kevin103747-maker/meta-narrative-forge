import { validate } from '../schema-factory/index.js';
import { SimulationTick } from './simulation-tick.js';
import { ContextAssembler } from './context-assembler.js';

export class RuntimeOrchestrator {
  constructor({ worldGraph = null, logicCompiler = null } = {}) {
    this.worldGraph = worldGraph;
    this.logicCompiler = logicCompiler;
    this.characters = new Map();
    this.currentSceneIndex = 0;
    this.elapsedHoursTotal = 0;
    this.contextProviders = [];
  }

  registerCharacter(characterData) {
    const check = validate('character', characterData);
    if (!check.valid) {
      throw new Error(`[RuntimeOrchestrator] 규격 오류: ${check.errors.join(', ')}`);
    }
    this.characters.set(characterData.id, JSON.parse(JSON.stringify(characterData)));
  }

  stepTick({ elapsedHours = 3, mentionedForeshadowIds = [], delta = {} } = {}) {
    this.currentSceneIndex += 1;
    this.elapsedHoursTotal += elapsedHours;
    SimulationTick.processBiologicalTick(this.characters, elapsedHours);
    SimulationTick.applyDelta(this.characters, delta);
    if (this.logicCompiler) {
      this.logicCompiler.tickScene(mentionedForeshadowIds);
    }
    return {
      currentSceneIndex: this.currentSceneIndex,
      elapsedHoursTotal: this.elapsedHoursTotal
    };
  }

  // 거시 모듈이 동결 코드 수정 없이 씬 패킷에 정보를 주입하는 확장 슬롯 (등록 순서대로 실행)
  registerContextProvider(name, fn, options = {}) {
    const provider = ContextAssembler.createProvider(name, fn, options);
    if (this.contextProviders.some(p => p.name === provider.name)) {
      throw new Error(`[RuntimeOrchestrator] 이미 등록된 context provider 입니다: '${provider.name}'`);
    }
    this.contextProviders.push(provider);
    return { name: provider.name, maxChars: provider.maxChars };
  }

  listContextProviders() {
    return this.contextProviders.map(p => ({ name: p.name, maxChars: p.maxChars }));
  }

  assemblePromptContext({ involvedCharacterIds, locationId }) {
    return ContextAssembler.assemble({
      characters: this.characters,
      worldGraph: this.worldGraph,
      logicCompiler: this.logicCompiler,
      involvedCharacterIds,
      locationId,
      currentSceneIndex: this.currentSceneIndex + 1,
      providers: this.contextProviders
    });
  }

  getCharacter(id) {
    return this.characters.get(id) || null;
  }
}

export { SimulationTick, ContextAssembler };
