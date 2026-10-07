/**
 * 씬 종료 시 물리/환경적 상태 변화를 결정론적으로 계산하는 엔진 (토큰 소모 0)
 */
export class SimulationTick {
  /**
   * 1씬 경과 시 인물들의 기본 생체 주기 갱신
   * @param {Map<string, object>} characters - 등록된 인물 맵
   * @param {number} elapsedHours - 이번 씬에서 경과한 시간(기본 3시간)
   */
  static processBiologicalTick(characters, elapsedHours = 3) {
    const hungerIncreaseRate = 2; // 시간당 허기 증가율
    
    for (const char of characters.values()) {
      if (!char.physical) continue;

      // 1. 허기 증가 (최대 100)
      char.physical.hunger = Math.min(100, (char.physical.hunger || 0) + (elapsedHours * hungerIncreaseRate));

      // 2. 부상 회복 턴 감소
      if (Array.isArray(char.physical.injuries)) {
        char.physical.injuries = char.physical.injuries
          .map(injury => {
            if (injury.healing_turns_left !== undefined) {
              injury.healing_turns_left -= 1;
            }
            return injury;
          })
          .filter(injury => injury.healing_turns_left === undefined || injury.healing_turns_left > 0);
      }

      // 3. 극심한 허기 시 체력 자연 감소
      if (char.physical.hunger >= 80) {
        char.physical.hp = Math.max(0, (char.physical.hp || 100) - 5);
      }
    }
  }

  /**
   * 씬 델타(Delta) 데이터를 실제 인물 상태에 적용
   * @param {Map<string, object>} characters 
   * @param {object} delta 
   */
  static applyDelta(characters, delta = {}) {
    if (delta.location_changes) {
      for (const [charId, newLoc] of Object.entries(delta.location_changes)) {
        const char = characters.get(charId);
        if (char) char.current_location = newLoc;
      }
    }

    if (delta.hp_changes) {
      for (const [charId, hpDiff] of Object.entries(delta.hp_changes)) {
        const char = characters.get(charId);
        if (char && char.physical) {
          char.physical.hp = Math.max(0, Math.min(100, (char.physical.hp || 100) + hpDiff));
        }
      }
    }

    if (delta.stress_changes) {
      for (const [charId, stressDiff] of Object.entries(delta.stress_changes)) {
        const char = characters.get(charId);
        if (char && char.psychological) {
          char.psychological.stress = Math.max(0, Math.min(100, (char.psychological.stress || 0) + stressDiff));
        }
      }
    }

    if (delta.inventory_additions) {
      for (const [charId, items] of Object.entries(delta.inventory_additions)) {
        const char = characters.get(charId);
        if (char && char.physical) {
          char.physical.inventory = [...(char.physical.inventory || []), ...items];
        }
      }
    }
  }
}
