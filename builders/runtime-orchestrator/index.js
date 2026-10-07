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
