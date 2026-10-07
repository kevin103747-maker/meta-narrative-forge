export class ContextAssembler {
  static assemble({ characters, worldGraph, logicCompiler, involvedCharacterIds = [], locationId, currentSceneIndex = 1 }) {
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

    const location = worldGraph ? worldGraph.getLocation(locationId) : null;
    const sceneLocation = location ? {
      id: location.id,
      name: location.name,
      zone_type: location.zone_type,
      attributes: location.attributes || []
    } : { id: locationId, name: '미확인 장소' };

    let activeForeshadows = [];
    if (logicCompiler) {
      const readiness = logicCompiler.evaluateSceneReadiness({ currentLocation: locationId });
      activeForeshadows = readiness.urgentForeshadows;
    }

    const systemInstruction = [
      `[SCENE CONTEXT #${currentSceneIndex}]`,
      `Location: ${sceneLocation.name} (${sceneLocation.zone_type})`,
      `Attributes: ${(sceneLocation.attributes || []).join(', ') || 'none'}`,
      `Characters: ${sceneCharacters.map(c => `${c.name}(${c.psychological.dominant_emotion})`).join(', ')}`,
      activeForeshadows.length > 0
        ? `Objective (Foreshadow): ${activeForeshadows.map(f => `"${f.title}"`).join(', ')}`
        : 'Objective: 자연스러운 전개 및 인물 상태 묘사'
    ].join('\n');

    return {
      systemInstruction,
      sceneLocation,
      sceneCharacters,
      activeForeshadows
    };
  }
}
