/**
 * Just-In-Time 프롬프트 컨텍스트 조립기 (토큰 극한 다이어트)
 */
export class ContextAssembler {
  /**
   * 이번 씬에 딱 필요한 정보만을 추출하여 정제된 패킷 생성
   * @param {object} params
   * @param {Map<string, object>} params.characters - 전체 인물 맵
   * @param {object} params.worldGraph - WorldGraphBuilder
   * @param {object} params.logicCompiler - NarrativeLogicCompiler
   * @param {string[]} params.involvedCharacterIds - 이번 씬 등장 인물 ID 목록
   * @param {string} params.locationId - 이번 씬 배경 장소 ID
   * @param {number} params.currentSceneIndex - 현재 씬 번호
   */
  static assemble({
    characters,
    worldGraph,
    logicCompiler,
    involvedCharacterIds = [],
    locationId,
    currentSceneIndex = 1
  }) {
    // 1. 등장 인물 데이터만 추출 및 불필요한 필드 가지치기
    const sceneCharacters = involvedCharacterIds.map(id => {
      const char = characters.get(id);
      if (!char) return null;
      return {
        id: char.id,
        name: char.name,
        role: char.role,
        physical: {
          hp: char.physical?.hp,
          hunger: char.physical?.hunger,
          injuries: char.physical?.injuries || [],
          inventory: char.physical?.inventory || []
        },
        psychological: {
          dominant_emotion: char.psychological?.dominant_emotion,
          stress: char.psychological?.stress,
          current_goal: char.psychological?.current_goal
        }
      };
    }).filter(Boolean);

    // 2. 현재 장소 정보만 추출
    const location = worldGraph ? worldGraph.getLocation(locationId) : null;
    const sceneLocation = location ? {
      id: location.id,
      name: location.name,
      zone_type: location.zone_type,
      attributes: location.attributes || []
    } : { id: locationId, name: '알 수 없는 장소' };

    // 3. 이번 장소/인물과 관련된 긴급 복선만 추출
    let activeForeshadows = [];
    if (logicCompiler) {
      const readiness = logicCompiler.evaluateSceneReadiness({
        currentLocation: locationId
      });
      // 이번 씬의 장소나 등장인물과 관련된 복선 우선 필터링
      activeForeshadows = readiness.urgentForeshadows.filter(f => {
        const milestone = f.target_milestone;
        if (!milestone) return true;
        if (milestone.required_location === locationId) return true;
        if (milestone.involved_characters?.some(cid => involvedCharacterIds.includes(cid))) return true;
        return false;
      });
    }

    // 4. LLM 주입용 미니멀 시스템 가이드라인 생성
    const systemInstruction = [
      `[SCENE CONTEXT #${currentSceneIndex}]`,
      `Location: ${sceneLocation.name} (${sceneLocation.zone_type})`,
      `Environment Tags: ${(sceneLocation.attributes || []).join(', ') || 'none'}`,
      `Active Characters: ${sceneCharacters.map(c => `${c.name}(${c.psychological.dominant_emotion})`).join(', ')}`,
      activeForeshadows.length > 0
        ? `Narrative Objectives (Foreshadows to evoke): ${activeForeshadows.map(f => `"${f.title}"`).join(', ')}`
        : 'Narrative Objectives: 자연스러운 갈등 전개 및 상태 묘사 집중'
    ].join('\n');

    return {
      systemInstruction,
      sceneLocation,
      sceneCharacters,
      activeForeshadows,
      assembledAt: new Date().toISOString()
    };
  }
}
