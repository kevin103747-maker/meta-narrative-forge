import { validate } from '../schema-factory/index.js';

export class ForeshadowTracker {
  constructor() {
    this.foreshadows = new Map();
  }

  /**
   * 신규 복선 등록
   * @param {object} data - foreshadow 스키마 만족 객체
   */
  register(data) {
    const check = validate('foreshadow', data);
    if (!check.valid) {
      throw new Error(`[ForeshadowTracker] 유효하지 않은 복선 데이터: ${check.errors.join(', ')}`);
    }

    if (this.foreshadows.has(data.id)) {
      throw new Error(`[ForeshadowTracker] 이미 존재하는 복선 ID: '${data.id}'`);
    }

    this.foreshadows.set(data.id, { ...data });
  }

  /**
   * 특정 씬이 끝날 때마다 방치 카운트 업데이트
   * @param {string[]} mentionedForeshadowIds - 해당 씬에서 환기/언급된 복선 ID 목록
   */
  tickScene(mentionedForeshadowIds = []) {
    const mentionedSet = new Set(mentionedForeshadowIds);

    for (const [id, item] of this.foreshadows.entries()) {
      if (item.status === 'resolved') continue;

      if (mentionedSet.has(id)) {
        item.neglect_count = 0;
        if (item.status === 'planted') {
          item.status = 'dormant';
        }
      } else {
        item.neglect_count += 1;
      }
    }
  }

  /**
   * 복선 상태 수동 전이
   * @param {string} id 
   * @param {'planted' | 'dormant' | 'triggered' | 'resolved'} newStatus 
   */
  transitionStatus(id, newStatus) {
    const item = this.foreshadows.get(id);
    if (!item) {
      throw new Error(`[ForeshadowTracker] 복선을 찾을 수 없음: '${id}'`);
    }
    item.status = newStatus;
  }

  /**
   * 방치 한계치에 근접하거나 초과한 긴급 복선 목록 추출 (4번 역방향 경유지 후보)
   */
  getUrgentForeshadows() {
    const urgent = [];
    for (const item of this.foreshadows.values()) {
      if (item.status === 'resolved') continue;

      const threshold = item.max_neglect_threshold || 10;
      if (item.neglect_count >= threshold) {
        urgent.push({
          ...item,
          urgency_score: item.neglect_count - threshold + 1,
          reason: `방치 한계치(${threshold}씬) 초과: 현재 ${item.neglect_count}씬 동안 침묵 중`
        });
      }
    }

    return urgent.sort((a, b) => b.urgency_score - a.urgency_score);
  }

  get(id) {
    return this.foreshadows.get(id) || null;
  }

  exportAll() {
    return Array.from(this.foreshadows.values());
  }
}
