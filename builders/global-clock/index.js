export class GlobalClock {
  constructor() {
    this.globalTime = 0;
    this.tickDurationHours = 1;
    this.localTimes = new Map(); // characterId -> localTime
    this.characterSet = new Set();
    this.snapshots = new Map(); // snapshotId -> snapshot data
    this.snapshotCounter = 0;
  }

  /**
   * 시계 초기화
   * @param {object} config
   * @param {number} config.startHour - 시작 시간 (기본 0)
   * @param {number} config.tickDurationHours - 한 틱당 시간 (기본 1시간)
   */
  initialize({ startHour = 0, tickDurationHours = 1 } = {}) {
    this.globalTime = startHour;
    this.tickDurationHours = tickDurationHours;
    this.localTimes.clear();
    this.characterSet.clear();
    this.snapshots.clear();
    this.snapshotCounter = 0;
  }

  /**
   * 캐릭터 등록 (로컬 시간 추적 시작)
   * @param {string} characterId
   */
  registerCharacter(characterId) {
    if (!characterId || typeof characterId !== 'string') {
      throw new TypeError('characterId는 문자열이어야 합니다');
    }
    if (this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 이미 등록되었습니다: ${characterId}`);
    }
    this.characterSet.add(characterId);
    this.localTimes.set(characterId, this.globalTime);
  }

  /**
   * 캐릭터 등록 해제
   * @param {string} characterId
   */
  unregisterCharacter(characterId) {
    if (!this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 등록되지 않았습니다: ${characterId}`);
    }
    this.characterSet.delete(characterId);
    this.localTimes.delete(characterId);
  }

  /**
   * 틱 전진
   * @param {number} ticks - 전진할 틱 수 (기본 1)
   */
  advance(ticks = 1) {
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new RangeError('ticks는 0 이상의 정수여야 합니다');
    }
    const deltaHours = ticks * this.tickDurationHours;
    this.globalTime += deltaHours;

    // 모든 캐릭터의 로컬 시간도 같이 전진 (별도 조정이 없는 경우)
    for (const characterId of this.characterSet) {
      const currentLocal = this.localTimes.get(characterId);
      this.localTimes.set(characterId, currentLocal + deltaHours);
    }
  }

  /**
   * 캐릭터의 로컬 시간 수동 조정 (이동/행동 시 사용)
   * @param {string} characterId
   * @param {number} deltaHours - 조정할 시간 (양수: 추가, 음수: 감소)
   */
  adjustLocalTime(characterId, deltaHours) {
    if (!this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 등록되지 않았습니다: ${characterId}`);
    }
    if (typeof deltaHours !== 'number' || isNaN(deltaHours)) {
      throw new TypeError('deltaHours는 숫자여야 합니다');
    }
    const currentLocal = this.localTimes.get(characterId);
    const newLocal = currentLocal + deltaHours;
    if (newLocal < 0) {
      throw new RangeError('로컬 시간은 음수가 될 수 없습니다');
    }
    this.localTimes.set(characterId, newLocal);
  }

  /**
   * 현재 글로벌 시간 반환
   * @returns {number}
   */
  getCurrentTime() {
    return this.globalTime;
  }

  /**
   * 캐릭터의 로컬 시간 반환
   * @param {string} characterId
   * @returns {number}
   */
  getLocalTime(characterId) {
    if (!this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 등록되지 않았습니다: ${characterId}`);
    }
    return this.localTimes.get(characterId);
  }

  /**
   * 캐릭터가 경험한 총 시간 반환 (등록 시점부터 현재까지)
   * @param {string} characterId
   * @returns {number}
   */
  getElapsedTime(characterId) {
    if (!this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 등록되지 않았습니다: ${characterId}`);
    }
    return this.localTimes.get(characterId);
  }

  /**
   * 글로벌 시간과 로컬 시간의 차이 반환 (시간 왜곡 정도)
   * @param {string} characterId
   * @returns {number} 양수: 로컬 시간이 더 많이 경과, 음수: 로컬 시간이 덜 경과
   */
  getTimeDivergence(characterId) {
    if (!this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 등록되지 않았습니다: ${characterId}`);
    }
    return this.localTimes.get(characterId) - this.globalTime;
  }

  /**
   * 현재 시간 상태 스냅샷 생성
   * @param {string} label - 스냅샷 라벨
   * @returns {string} snapshotId
   */
  createSnapshot(label = '') {
    const snapshotId = `snap_${this.snapshotCounter++}`;
    const snapshot = {
      id: snapshotId,
      label,
      globalTime: this.globalTime,
      tickDurationHours: this.tickDurationHours,
      localTimes: new Map(this.localTimes),
      characterSet: new Set(this.characterSet),
      timestamp: new Date().toISOString()
    };
    this.snapshots.set(snapshotId, snapshot);
    return snapshotId;
  }

  /**
   * 스냅샷으로 시간 상태 복원
   * @param {string} snapshotId
   */
  restoreSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
    }
    this.globalTime = snapshot.globalTime;
    this.tickDurationHours = snapshot.tickDurationHours;
    this.localTimes = new Map(snapshot.localTimes);
    this.characterSet = new Set(snapshot.characterSet);
  }

  /**
   * 스냅샷 삭제
   * @param {string} snapshotId
   */
  deleteSnapshot(snapshotId) {
    if (!this.snapshots.has(snapshotId)) {
      throw new Error(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
    }
    this.snapshots.delete(snapshotId);
  }

  /**
   * 모든 스냅샷 목록 반환
   * @returns {Array}
   */
  listSnapshots() {
    return Array.from(this.snapshots.values()).map(s => ({
      id: s.id,
      label: s.label,
      globalTime: s.globalTime,
      timestamp: s.timestamp
    }));
  }

  /**
   * 현재 상태 내보내기
   * @returns {object}
   */
  exportState() {
    return {
      globalTime: this.globalTime,
      tickDurationHours: this.tickDurationHours,
      localTimes: Object.fromEntries(this.localTimes),
      characters: Array.from(this.characterSet)
    };
  }

  /**
   * 상태 가져오기
   * @param {object} state
   */
  importState(state) {
    this.globalTime = state.globalTime;
    this.tickDurationHours = state.tickDurationHours;
    this.localTimes = new Map(Object.entries(state.localTimes));
    this.characterSet = new Set(state.characters);
  }
}
