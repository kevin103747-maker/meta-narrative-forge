# Meta-Narrative Forge - Handoff Document

## 프로젝트 개요

**저장소:** `https://github.com/kevin103747-maker/meta-narrative-forge` (브랜치: `main`)

**목표:** 소설 작성용 세계관 시뮬레이션 엔진 SDK 구축
- 작가는 마스터 플롯/복선을 LLM과 함께 직접 입력
- 툴은 작가가 생각하지 못한 세계 물리 상황을 시뮬레이션
- LLM은 시뮬레이션 결과를 바탕으로 글을 작성

**핵심 철학:**
1. LLM을 계산기(거리, 시간, 체력 등)로 쓰지 않고 순수 코드(토큰 소모 0)로 상태 연산
2. JIT(Just-In-Time)로 씬마다 필요한 300~500토큰만 조립 주입
3. 유리관 미로(외생적 가드레일) + 목표 지향적 역방향 역산으로 서사 통제
4. GitHub을 AI의 외부 뇌(SSOT)로 사용

---

## 현재까지 완료된 모듈 (6대 코어 빌더)

### 1. WorldGraphBuilder (v0.1.0, FROZEN)
- **기능:** 세계 지도 구축, 최단 경로 연산 (다익스트라)
- **파일:** `builders/world-graph-builder/`
- **의존성:** 없음

### 2. SchemaFactory (v0.1.0, FROZEN)
- **기능:** 스키마 정의 및 검증
- **파일:** `builders/schema-factory/`
- **의존성:** 없음

### 3. NarrativeLogicCompiler (v0.1.1, FROZEN)
- **기능:** 복선 수명 주기 관리, 방치 감시, 역방향 복선 경유지 추천, 탈선 감지(유리관 미로)
- **파일:** `builders/narrative-logic-compiler/`
- **의존성:** `builders/schema-factory`, `builders/world-graph-builder`
- **최근 수정:** 결함 수정 (maxAllowedDeviationHours 0 치환 문제, 일방통행 탈선 감지)

### 4. RuntimeOrchestrator (v0.2.1, FROZEN)
- **기능:** 씬 단위 시뮬레이션 틱 연산, 인물 상태 갱신, JIT 프롬프트 패킷 조립, Context Provider 확장 슬롯
- **파일:** `builders/runtime-orchestrator/`
- **의존성:** `builders/schema-factory`, `builders/world-graph-builder`, `builders/narrative-logic-compiler`

### 5. ConspiracyTruthLedger (v0.1.1, FROZEN)
- **기능:** 진실(Fact)/믿음(Belief)/소문(Rumor) 분리 관리, 그래프 거리에 따른 왜곡, 봉인 해제
- **파일:** `builders/conspiracy-truth-ledger/`
- **의존성:** `builders/world-graph-builder`, `builders/narrative-logic-compiler`

### 6. GlobalClock (v0.1.0, FROZEN) - **신규**
- **기능:** 글로벌 시계, 틱 기반 시뮬레이션, 캐릭터별 로컬 시간 추적, 스냅샷/복원
- **파일:** `builders/global-clock/`
- **의존성:** 없음
- **커밋:** `0e5614d` - T4: global-clock module for multi-character simulation

### 7. MultiCharacterSim (v0.1.0, FROZEN) - **신규**
- **기능:** 다중 캐릭터 병렬 상태 업데이트, 우선순위 큐, 위치 기반 그룹핑, 조우 감지, 이동 처리
- **파일:** `builders/multi-character-sim/`
- **의존성:** `builders/global-clock`, `builders/world-graph-builder`
- **커밋:** `90c9c14` - T4.1: multi-character-sim module for parallel simulation

---

## 현재 작업 상태

**마지막 작업:** Multi-Character Sim 모듈 구현 완료 (Phase 1: 기본 다중 캐릭터 시뮬레이션)

**완료된 Phase:**
- ✅ Phase 1: 기본 다중 캐릭터 시뮬레이션
  - Global Clock (T4)
  - Multi-Character Sim (T4.1)

**진행 중인 작업:** 없음

---

## 다음 단계 제안

### Phase 2: 상호작용 (권장)
1. **Character Interaction System** - 같은 장소에 있는 캐릭터 간 자동 상호작용 처리
   - 관계 기반 상호작용 (친구/적대/중립)
   - 상호작용 우선순위
   - 그룹 상호작용

2. **Distributed Simulation Tracker** - 캐릭터별 활동 로그, 시간 경과에 따른 상태 변화 추적

### Phase 3: 작가 도구
3. **Scene Selection & Camera System** - 작가가 어느 캐릭터/장소의 시점에서 글을 쓸지 선택
4. **Interaction Outcome Predictor** - 캐릭터 조우 시 결과 미리 예측

### Phase 4: 세계 물리 엔진
5. **Environment Simulator** - 날씨/시간대/계절 시뮬레이션
6. **Movement Physics Simulator** - 이동에 따른 물리적 비용 계산
7. **Random Event Generator** - 우연적 사건 생성
8. **Population Simulation** - NPC 자율 이동
9. **Resource Economy Simulator** - 아이템/화폐 흐름

### Phase 5: LLM 연결
10. **Simulation-to-Prompt Generator** - 시뮬레이션 결과를 LLM 프롬프트로 변환

---

## 워크플로우 예시

```javascript
// 1. 글로벌 시계 초기화
globalClock.initialize({ startHour: 0, tickDurationHours: 1 });

// 2. 캐릭터들 등록
multiSim.registerCharacters([ethan, rowen, villain]);

// 3. 시뮬레이션 (각 캐릭터 다른 행동)
for (let i = 0; i < 10; i++) {
  multiSim.advanceTick({
    globalDelta: 1,
    characterActions: [
      { characterId: 'char_hero_01', action: 'move', target: 'loc_ancient_altar' },
      { characterId: 'char_rogue_02', action: 'gather_info', location: 'loc_city' },
      { characterId: 'char_villain_01', action: 'recruit_army', location: 'loc_castle' }
    ]
  });
}

// 4. 현재 상태 확인
const currentStates = distributedTracker.getCurrentStates();

// 5. 씬 선택
const sceneOptions = sceneSelector.getSuggestedScenes();

// 6. LLM 프롬프트 생성
const prompt = promptGenerator.buildForScene(sceneOptions[0]);

// 7. LLM에 전달하여 글 작성
const story = await llm.generate(prompt);
```

---

## 기술 스택

- **언어:** JavaScript (ES Modules)
- **런타임:** Node.js
- **패키지 매니저:** npm
- **버전 관리:** Git
- **거버넌스:** 커스텀 시스템 (contract.json, audit, freeze, unfreeze, ratify)

---

## 커밋 기록 (최근 5개)

```
90c9c14 T4.1: multi-character-sim module for parallel simulation
0e5614d T4: global-clock module for multi-character simulation
7eda4b5 Fix: guardrail zero-tolerance and one-way trap detection
a995d79 T3.5: glass maze guardrail trajectory divergence test
64a030a T3: conspiracy-truth-ledger v0.1.0 (fact/belief/rumor, seals, provider)
```

---

## 주의사항

### 헌법 준수 (system/CONSTITUTION.md)
1. **단일 진실 공급원:** Git에 커밋된 파일만 진실
2. **원자적 트랜잭션:** 작업 전 파일 목록과 순서 선언, 하나라도 실패하면 전체 롤백
3. **결정적 규칙 우선:** 시공간 연산은 코드로, LLM은 결과 서사화만 담당
4. **명시적 경로:** 모듈 참조는 디렉터리 기반 경로로 (`@/builders/...`)
5. **인간 감독관 승인:** 모든 결정은 감독관 승인 후 Git 커밋
6. **동결 해제와 개정 이력:** 동결 해제는 unfreeze, superseded_modules에 보존

### 표준 절차
1. 목표 협의
2. contract.json 선언
3. npm run audit
4. 구현
5. npm run test:smoke
6. npm run audit
7. npm run freeze
8. Git 커밋

### 테스트 실행
```bash
npm run test:smoke  # 통합 테스트
npm run audit      # 정적 무결성 감사
```

### 모듈 동결/해제
```bash
npm run freeze <모듈명>           # 모듈 동결
npm run unfreeze <모듈명> --approved-by <이름> --reason "<사유>" --yes  # 모듈 해제
```

---

## 작업 시작 전 체크리스트

- [ ] 원격 저장소 최신 상태 확인 (`git pull`)
- [ ] 현재 브랜치 확인 (`git branch`)
- [ ] 작업할 모듈의 contract.json 확인
- [ ] 의존성 확인 (internal_modules, allowed_external_pkgs)
- [ ] 테스트 파일 위치 확인 (`tests/smoke-test.js`)
- [ ] 감독관 승인 필요 여부 확인 (동결 해제 시)

---

## 연락처

- **저장소:** https://github.com/kevin103747-maker/meta-narrative-forge
- **이슈:** GitHub Issues
- **문서:** system/CONSTITUTION.md

---

**생성일:** 2026-10-08
**마지막 업데이트:** 2026-10-08
**작업 완료:** Phase 1 (Global Clock, Multi-Character Sim)
**다음 작업:** Phase 2 (Character Interaction System, Distributed Simulation Tracker)
