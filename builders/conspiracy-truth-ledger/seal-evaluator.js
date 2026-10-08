export class SealEvaluator {
  // 모든 조건(all)을 만족해야 해제 가능. 미충족 사유를 결정론적 순서로 반환
  static evaluate(seal, { sceneIndex, locationId, presentCharacterIds = [] } = {}, logicCompiler = null) {
    if (!seal) return { satisfied: true, unmet: [] };
    const present = new Set(presentCharacterIds);
    const unmet = [];

    for (const cond of seal.all) {
      switch (cond.type) {
        case 'scene_at_least':
          if (!(Number.isInteger(sceneIndex) && sceneIndex >= cond.value)) unmet.push(`씬 #${cond.value} 이후`);
          break;
        case 'location':
          if (locationId !== cond.value) unmet.push(`장소 ${cond.value}`);
          break;
        case 'present': {
          const missing = cond.value.filter(id => !present.has(id));
          if (missing.length > 0) unmet.push(`동석 ${missing.join(',')}`);
          break;
        }
        case 'foreshadow_status': {
          const item = logicCompiler
            ? logicCompiler.exportState().foreshadows.find(f => f.id === cond.id)
            : null;
          if (!item) unmet.push(`복선 ${cond.id} 조회 불가`);
          else if (!cond.statuses.includes(item.status)) {
            unmet.push(`복선 ${cond.id} 상태 ${cond.statuses.join('|')} 필요 (현재 ${item.status})`);
          }
          break;
        }
      }
    }
    return { satisfied: unmet.length === 0, unmet };
  }
}
