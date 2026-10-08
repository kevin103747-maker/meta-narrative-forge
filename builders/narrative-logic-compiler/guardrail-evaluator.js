export class GuardrailEvaluator {
  /**
   * 탈선 위험도 검증
   * @param {object} params
   * @param {object} params.worldGraph - WorldGraphBuilder 인스턴스
   * @param {string} params.currentLocation - 현재 인물 위치 ID
   * @param {string} params.plannedDestination - 이동하려는 목표 위치 ID
   * @param {string[]} params.targetMilestoneLocations - 향후 필수 경유지 목록
   * @param {number} params.maxAllowedDeviationHours - 허용 가능한 최대 우회 시간
   */
  static evaluateDivergence({
    worldGraph,
    currentLocation,
    plannedDestination,
    targetMilestoneLocations = [],
    maxAllowedDeviationHours = 24
  }) {
    const warnings = [];

    if (!worldGraph || !currentLocation || !plannedDestination) {
      return { divergent: false, warnings };
    }

    // 1. 계획된 목적지 도달 가능 여부
    const pathToDestination = worldGraph.findPath(currentLocation, plannedDestination);
    if (!pathToDestination.possible) {
      warnings.push({
        type: 'UNREACHABLE_DESTINATION',
        severity: 'high',
        message: `목적지 '${plannedDestination}'는 현재 위치 '${currentLocation}'에서 연결된 도로가 없습니다.`
      });
      return { divergent: true, warnings };
    }

    // 2. 필수 경유지들과의 거리 괴리 검증
    for (const milestone of targetMilestoneLocations) {
      const fromDestToMilestone = worldGraph.findPath(plannedDestination, milestone);
      const fromCurrToMilestone = worldGraph.findPath(currentLocation, milestone);

      if (fromDestToMilestone.possible && fromCurrToMilestone.possible) {
        const addedHours = fromDestToMilestone.totalHours - fromCurrToMilestone.totalHours;
        if (addedHours > maxAllowedDeviationHours) {
          warnings.push({
            type: 'TRAJECTORY_DIVERGENCE',
            severity: 'medium',
            milestone,
            addedHours,
            message: `목적지 이동 시 필수 경유지 '${milestone}'와의 이동 시간이 ${addedHours}시간 증가합니다. (외생적 장벽 권고)`
          });
        }
      }
    }

    // 3. 일방통행 탈선 감지: 목적지에서 현재 위치로 복귀 가능 여부
    const returnPath = worldGraph.findPath(plannedDestination, currentLocation);
    if (!returnPath.possible) {
      warnings.push({
        type: 'ONE_WAY_TRAP',
        severity: 'high',
        message: `목적지 '${plannedDestination}'에서 현재 위치 '${currentLocation}'로 복귀할 수 있는 경로가 없습니다. 일방통행 트랩입니다.`
      });
    }

    return {
      divergent: warnings.length > 0,
      warnings
    };
  }
}
