export class MultiCharacterSim {
  constructor() {
    this.globalClock = null;
    this.worldGraph = null;
    this.characters = new Map(); // characterId -> character state
    this.characterSet = new Set();
    this.snapshots = new Map();
    this.snapshotCounter = 0;

    // 캐릭터 역할별 우선순위
    this.rolePriority = {
      protagonist: 10,
      supporting: 8,
      antagonist: 7,
      npc: 5
    };
  }

  /**
   * 시뮬레이션 초기화
   * @param {object} config
   * @param {object} config.globalClock - GlobalClock 인스턴스
   * @param {object} config.worldGraph - WorldGraphBuilder 인스턴스
   */
  initialize({ globalClock, worldGraph }) {
    if (!globalClock) {
      throw new Error('globalClock은 필수입니다');
    }
    if (!worldGraph) {
      throw new Error('worldGraph는 필수입니다');
    }
    this.globalClock = globalClock;
    this.worldGraph = worldGraph;
    this.characters.clear();
    this.characterSet.clear();
    this.snapshots.clear();
    this.snapshotCounter = 0;
  }

  /**
   * 캐릭터 등록
   * @param {object} character
   * @param {string} character.id
   * @param {string} character.name
   * @param {string} character.role - protagonist, supporting, antagonist, npc
   * @param {string} character.currentLocation
   * @param {object} character.physical
   * @param {object} character.psychological
   * @param {object} character.relations
   */
  registerCharacter(character) {
    if (!character || !character.id) {
      throw new Error('캐릭터 ID는 필수입니다');
    }
    if (this.characterSet.has(character.id)) {
      throw new Error(`캐릭터가 이미 등록되었습니다: ${character.id}`);
    }

    const characterState = {
      id: character.id,
      name: character.name || 'Unknown',
      role: character.role || 'npc',
      currentLocation: character.currentLocation,
      physical: {
        hp: character.physical?.hp || 100,
        hunger: character.physical?.hunger || 0,
        stamina: character.physical?.stamina || 100,
        injuries: character.physical?.injuries || [],
        inventory: character.physical?.inventory || []
      },
      psychological: {
        dominant_emotion: character.psychological?.dominant_emotion || 'neutral',
        stress: character.psychological?.stress || 0,
        trauma_triggers: character.psychological?.trauma_triggers || [],
        current_goal: character.psychological?.current_goal || ''
      },
      relations: character.relations || {},
      status: 'idle', // idle, moving, acting, in_combat
      lastAction: null,
      lastActionTime: 0
    };

    this.characters.set(character.id, characterState);
    this.characterSet.add(character.id);

    // GlobalClock에도 등록
    if (this.globalClock) {
      try {
        this.globalClock.registerCharacter(character.id);
      } catch (e) {
        // 이미 등록된 경우 무시
      }
    }
  }

  /**
   * 캐릭터 등록 해제
   * @param {string} characterId
   */
  unregisterCharacter(characterId) {
    if (!this.characterSet.has(characterId)) {
      throw new Error(`캐릭터가 등록되지 않았습니다: ${characterId}`);
    }
    this.characters.delete(characterId);
    this.characterSet.delete(characterId);

    if (this.globalClock) {
      try {
        this.globalClock.unregisterCharacter(characterId);
      } catch (e) {
        // 이미 해제된 경우 무시
      }
    }
  }

  /**
   * 캐릭터 우선순위 계산
   * @param {string} characterId
   * @returns {number}
   */
  getPriority(characterId) {
    const character = this.characters.get(characterId);
    if (!character) return 0;
    return this.rolePriority[character.role] || 5;
  }

  /**
   * 틱 전진
   * @param {object} params
   * @param {number} params.globalDelta - 글로벌 시간 증가량 (틱 수)
   * @param {Array} params.characterActions - 캐릭터별 행동 배열
   * @returns {object} tickResult
   */
  advanceTick({ globalDelta = 1, characterActions = [] }) {
    if (!this.globalClock) {
      throw new Error('GlobalClock이 초기화되지 않았습니다');
    }

    const result = {
      advancedCharacters: [],
      encounters: [],
      warnings: []
    };

    // 1. 글로벌 시간 전진
    this.globalClock.advance(globalDelta);

    // 2. 캐릭터 우선순위별 정렬
    const sortedCharacters = Array.from(this.characterSet).sort((a, b) => {
      return this.getPriority(b) - this.getPriority(a);
    });

    // 3. 캐릭터별 행동 처리
    for (const characterId of sortedCharacters) {
      const action = characterActions.find(a => a.characterId === characterId);
      this.processCharacterAction(characterId, action, result);
    }

    // 4. 위치 기반 그룹핑 및 조우 감지
    this.detectEncounters(result);

    return result;
  }

  /**
   * 캐릭터 행동 처리
   * @param {string} characterId
   * @param {object} action
   * @param {object} result
   */
  processCharacterAction(characterId, action, result) {
    const character = this.characters.get(characterId);
    if (!character) return;

    if (!action) {
      // 행동이 없으면 대기 상태로 유지
      character.status = 'idle';
      character.lastAction = 'wait';
      character.lastActionTime = this.globalClock.getCurrentTime();
      result.advancedCharacters.push(characterId);
      return;
    }

    switch (action.action) {
      case 'move':
        this.processMove(character, action, result);
        break;
      case 'wait':
        character.status = 'idle';
        character.lastAction = 'wait';
        break;
      case 'act':
        character.status = 'acting';
        character.lastAction = action.activity || 'generic_action';
        break;
      default:
        result.warnings.push({
          type: 'UNKNOWN_ACTION',
          characterId,
          action: action.action
        });
    }

    character.lastActionTime = this.globalClock.getCurrentTime();
    result.advancedCharacters.push(characterId);
  }

  /**
   * 이동 처리
   * @param {object} character
   * @param {object} action
   * @param {object} result
   */
  processMove(character, action, result) {
    if (!this.worldGraph) {
      result.warnings.push({
        type: 'NO_WORLD_GRAPH',
        characterId: character.id
      });
      return;
    }

    const targetLocation = action.target;
    if (!targetLocation) {
      result.warnings.push({
        type: 'NO_TARGET_LOCATION',
        characterId: character.id
      });
      return;
    }

    // 경로 계산
    const path = this.worldGraph.findPath(character.currentLocation, targetLocation);
    if (!path.possible) {
      result.warnings.push({
        type: 'UNREACHABLE_TARGET',
        characterId: character.id,
        from: character.currentLocation,
        to: targetLocation
      });
      return;
    }

    // 이동 시간 적용 (GlobalClock 로컬 시간 조정)
    const travelTime = path.totalHours;
    try {
      this.globalClock.adjustLocalTime(character.id, travelTime);
    } catch (e) {
      result.warnings.push({
        type: 'TIME_ADJUSTMENT_FAILED',
        characterId: character.id,
        reason: e.message
      });
      return;
    }

    // 위치 업데이트
    character.currentLocation = targetLocation;
    character.status = 'moving';
    character.lastAction = `move_to_${targetLocation}`;

    // 이동에 따른 체력/허기 감소 (단순 계산)
    const staminaCost = Math.floor(travelTime * 2);
    const hungerIncrease = Math.floor(travelTime * 3);
    character.physical.stamina = Math.max(0, character.physical.stamina - staminaCost);
    character.physical.hunger = Math.min(100, character.physical.hunger + hungerIncrease);
  }

  /**
   * 조우 감지 (위치 기반 그룹핑)
   * @param {object} result
   */
  detectEncounters(result) {
    const locationGroups = new Map();

    // 장소별 캐릭터 그룹핑
    for (const characterId of this.characterSet) {
      const character = this.characters.get(characterId);
      const location = character.currentLocation;

      if (!locationGroups.has(location)) {
        locationGroups.set(location, []);
      }
      locationGroups.get(location).push(characterId);
    }

    // 2명 이상인 장소에서만 조우 이벤트 생성
    for (const [location, characterIds] of locationGroups) {
      if (characterIds.length >= 2) {
        result.encounters.push({
          type: 'co_location',
          location,
          participants: characterIds,
          timestamp: this.globalClock.getCurrentTime()
        });
      }
    }
  }

  /**
   * 캐릭터 상태 반환
   * @param {string} characterId
   * @returns {object}
   */
  getCharacter(characterId) {
    const character = this.characters.get(characterId);
    if (!character) {
      throw new Error(`캐릭터를 찾을 수 없습니다: ${characterId}`);
    }
    // 깊은 복사 반환
    return JSON.parse(JSON.stringify(character));
  }

  /**
   * 해당 장소에 있는 캐릭터 목록 반환
   * @param {string} locationId
   * @returns {Array}
   */
  getCharactersAtLocation(locationId) {
    const characters = [];
    for (const characterId of this.characterSet) {
      const character = this.characters.get(characterId);
      if (character.currentLocation === locationId) {
        characters.push(JSON.parse(JSON.stringify(character)));
      }
    }
    return characters;
  }

  /**
   * 모든 캐릭터 상태 반환
   * @returns {Array}
   */
  getAllCharacters() {
    return Array.from(this.characters.values()).map(c => JSON.parse(JSON.stringify(c)));
  }

  /**
   * 스냅샷 생성
   * @param {string} label
   * @returns {string} snapshotId
   */
  createSnapshot(label = '') {
    const snapshotId = `sim_snap_${this.snapshotCounter++}`;
    const snapshot = {
      id: snapshotId,
      label,
      globalTime: this.globalClock ? this.globalClock.getCurrentTime() : 0,
      characters: JSON.parse(JSON.stringify(Array.from(this.characters.entries()))),
      timestamp: new Date().toISOString()
    };
    this.snapshots.set(snapshotId, snapshot);
    return snapshotId;
  }

  /**
   * 스냅샷 복원
   * @param {string} snapshotId
   */
  restoreSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
    }

    // 캐릭터 상태 복원
    this.characters = new Map(snapshot.characters);
    this.characterSet = new Set(this.characters.keys());

    // GlobalClock 시간 복원 (스냷샷의 상태를 직접 가져옴)
    if (this.globalClock) {
      const exportedClock = this.globalClock.exportState();
      exportedClock.globalTime = snapshot.globalTime;
      // 스냅샷에 저장된 캐릭터 로컬 시간 복원
      const localTimes = {};
      for (const characterId of this.characterSet) {
        const character = this.characters.get(characterId);
        localTimes[characterId] = snapshot.globalTime; // 일단 글로벌 시간으로 초기화
      }
      exportedClock.localTimes = localTimes;
      this.globalClock.importState(exportedClock);
    }
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
      globalTime: this.globalClock ? this.globalClock.getCurrentTime() : 0,
      characters: JSON.parse(JSON.stringify(Array.from(this.characters.entries())))
    };
  }

  /**
   * 상태 가져오기
   * @param {object} state
   */
  importState(state) {
    this.characters = new Map(state.characters);
    this.characterSet = new Set(this.characters.keys());

    if (this.globalClock) {
      const currentTime = this.globalClock.getCurrentTime();
      const targetTime = state.globalTime;
      const delta = targetTime - currentTime;
      if (delta !== 0) {
        this.globalClock.advance(delta);
      }
    }
  }
}
