import { ForeshadowTracker } from './foreshadow-tracker.js';
import { GuardrailEvaluator } from './guardrail-evaluator.js';

export class NarrativeLogicCompiler {
  constructor(worldGraph = null) {
    this.tracker = new ForeshadowTracker();
    this.worldGraph = worldGraph;
  }

  setWorldGraph(worldGraph) {
    this.worldGraph = worldGraph;
  }

  registerForeshadow(data) {
    this.tracker.register(data);
  }

  tickScene(mentionedForeshadowIds = []) {
    this.tracker.tickScene(mentionedForeshadowIds);
  }

  transitionStatus(id, newStatus) {
    this.tracker.transitionStatus(id, newStatus);
  }

  /**
   * 다음 씬 집필 준비 상태 종합 판정 (3+4번 블렌딩)
   * @param {object} context
   * @param {string} context.currentLocation
   * @param {string} [context.plannedDestination]
   * @param {number} [context.maxAllowedDeviationHours]
   */
  evaluateSceneReadiness(context = {}) {
    const urgentForeshadows = this.tracker.getUrgentForeshadows();

    // 긴급 복선들의 목표 장소를 경유지로 수집
    const milestoneLocations = urgentForeshadows
      .filter(item => item.target_milestone && item.target_milestone.required_location)
      .map(item => item.target_milestone.required_location);

    let guardrailCheck = { divergent: false, warnings: [] };

    if (this.worldGraph && context.currentLocation && context.plannedDestination) {
      guardrailCheck = GuardrailEvaluator.evaluateDivergence({
        worldGraph: this.worldGraph,
        currentLocation: context.currentLocation,
        plannedDestination: context.plannedDestination,
        targetMilestoneLocations: milestoneLocations,
        maxAllowedDeviationHours: context.maxAllowedDeviationHours || 24
      });
    }

    return {
      urgentForeshadows,
      guardrailWarnings: guardrailCheck.warnings,
      isDivergent: guardrailCheck.divergent
    };
  }

  exportState() {
    return {
      foreshadows: this.tracker.exportAll()
    };
  }
}

export { ForeshadowTracker, GuardrailEvaluator };
