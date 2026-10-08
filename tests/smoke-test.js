import assert from 'node:assert/strict';
import { WorldGraphBuilder } from '../builders/world-graph-builder/index.js';
import { NarrativeLogicCompiler } from '../builders/narrative-logic-compiler/index.js';
import { RuntimeOrchestrator } from '../builders/runtime-orchestrator/index.js';
import { GlobalClock } from '../builders/global-clock/index.js';
import { MultiCharacterSim } from '../builders/multi-character-sim/index.js';

console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log('\x1b[35m%s\x1b[0m', '🚀 [meta-narrative-forge] 6대 코어 빌더 통합 구동 테스트');
console.log('\x1b[35m%s\x1b[0m', '==================================================\n');

// 1. 전술판(WorldGraphBuilder) 구축
console.log('📍 1. 전술 지도 구축 중...');
const world = new WorldGraphBuilder();

world.addLocation({
  id: 'loc_tavern',
  name: '안개 낀 까마귀 주점',
  zone_type: 'settlement',
  attributes: ['어두움', '소란스러움', '밀수꾼 집결지'],
  connected_edges: [
    { target_node_id: 'loc_forest_entrance', travel_cost_hours: 2, danger_level: 2 }
  ]
});

world.addLocation({
  id: 'loc_forest_entrance',
  name: '망각의 숲 어귀',
  zone_type: 'wilderness',
  attributes: ['안개', '시야 제한', '야생 짐승'],
  connected_edges: [
    { target_node_id: 'loc_tavern', travel_cost_hours: 2, danger_level: 2 },
    { target_node_id: 'loc_ancient_altar', travel_cost_hours: 5, danger_level: 4 }
  ]
});

world.addLocation({
  id: 'loc_ancient_altar',
  name: '고대 태양의 제단',
  zone_type: 'sacred',
  attributes: ['봉인된 유적', '신성한 침묵'],
  connected_edges: [
    { target_node_id: 'loc_forest_entrance', travel_cost_hours: 5, danger_level: 4 }
  ]
});

console.log('   ✅ 거점 3개 등록 완료. (주점 <-> 숲 어귀 <-> 고대 제단)');

// 2. 다익스트라 최단 경로 연산 검증 (토큰 0)
const pathCheck = world.findPath('loc_tavern', 'loc_ancient_altar');
console.log(`   🗺️ 주점에서 고대 제단까지 최적 경로: ${pathCheck.path.join(' -> ')} (총 ${pathCheck.totalHours}시간 소요, 최대 위험도: ${pathCheck.maxDanger})`);

// 3. 인과율 컴파일러(NarrativeLogicCompiler) 세팅 및 복선 등록
console.log('\n📜 2. 인과율 규칙 및 체호프의 복선 등록 중...');
const logic = new NarrativeLogicCompiler(world);

logic.registerForeshadow({
  id: 'gun_001_pendant',
  title: '피 묻은 가문의 펜던트',
  status: 'planted',
  planted_scene: 'scene_001',
  neglect_count: 0,
  max_neglect_threshold: 2, // 2씬 동안 안 나오면 경고
  target_milestone: {
    required_location: 'loc_ancient_altar',
    involved_characters: ['char_hero_01']
  }
});
console.log('   ✅ 복선 등록: "피 묻은 가문의 펜던트" (목표: 고대 제단에서 주인공에 의해 회수)');

// 4. 런타임 오케스트레이터(RuntimeOrchestrator) 초기화 및 인물 등록
console.log('\n🎭 3. 런타임 오케스트레이터 초기화 및 인물 배치...');
const orchestrator = new RuntimeOrchestrator({
  worldGraph: world,
  logicCompiler: logic
});

orchestrator.registerCharacter({
  id: 'char_hero_01',
  name: '에단',
  role: 'protagonist',
  current_location: 'loc_tavern',
  physical: { hp: 100, hunger: 10, stamina: 90, injuries: [], inventory: ['부러진 단검'] },
  psychological: { dominant_emotion: '불안', stress: 30, trauma_triggers: ['피 냄새'], current_goal: '가문의 진실 추적' },
  relations: {},
  known_facts: ['아버지가 숲 너머 제단에서 실종되었다는 소문']
});

orchestrator.registerCharacter({
  id: 'char_rogue_02',
  name: '로웬',
  role: 'supporting',
  current_location: 'loc_tavern',
  physical: { hp: 90, hunger: 20, stamina: 80, injuries: [], inventory: ['만능 열쇠'] },
  psychological: { dominant_emotion: '교활함', stress: 15, trauma_triggers: [], current_goal: '돈벌이' },
  relations: {},
  known_facts: []
});
console.log('   ✅ 인물 2명(에단, 로웬) 주점에 배치 완료.');

// 5. [씬 1] 시뮬레이션 및 프롬프트 패킷 조립 (JIT Diet Prompt)
console.log('\n🎬 4. [제1장] 씬 프롬프트 컨텍스트 생성 (토큰 극한 다이어트)...');
const scene1Context = orchestrator.assemblePromptContext({
  involvedCharacterIds: ['char_hero_01', 'char_rogue_02'],
  locationId: 'loc_tavern'
});

console.log('\x1b[33m%s\x1b[0m', '--- [LLM에 실제 전달될 압축 시스템 인스트럭션 (단 400토큰 내외)] ---');
console.log(scene1Context.systemInstruction);
console.log('\x1b[33m%s\x1b[0m', '------------------------------------------------------------------');

// 6. [씬 1 종료] 틱 전진 및 물리/복선 갱신 (시간 3시간 경과)
console.log('\n⏱️ 5. [제1장 종료] 틱 전진 (3시간 경과, 이동 및 체력 갱신)...');
orchestrator.stepTick({
  elapsedHours: 3,
  mentionedForeshadowIds: [], // 이번 장에서는 펜던트 복선 언급 안 함
  delta: {
    stress_changes: { 'char_hero_01': +15 }, // 에단 스트레스 증가
    inventory_additions: { 'char_hero_01': ['낡은 지도'] }
  }
});

const heroStateAfterS1 = orchestrator.getCharacter('char_hero_01');
console.log(`   📊 [에단 상태] 체력: ${heroStateAfterS1.physical.hp}, 허기: ${heroStateAfterS1.physical.hunger}(+6 증가), 스트레스: ${heroStateAfterS1.psychological.stress}, 소지품: ${heroStateAfterS1.physical.inventory.join(', ')}`);

// 7. [씬 2 전진] 복선 방치 한계치 도달 테스트
console.log('\n⏱️ 6. [제2장 진행 및 종료] 추가 틱 전진 (복선 방치 감시)...');
orchestrator.stepTick({
  elapsedHours: 4,
  mentionedForeshadowIds: [] // 2번째 씬에서도 복선 침묵
});

// 8. 3+4번 블렌딩: 긴급 복선 회수 알림 및 유리관 미로(탈선 감지) 검증
console.log('\n🚨 7. [3+4번 블렌딩] 서사 가드레일 및 긴급 복선 판정...');
const readiness = logic.evaluateSceneReadiness({
  currentLocation: 'loc_tavern',
  plannedDestination: 'loc_ancient_altar' // 제단으로 직행하려는 시도
});

console.log(`   ⚠️ 긴급 환기 복선 수: ${readiness.urgentForeshadows.length}개 발견`);
readiness.urgentForeshadows.forEach(f => console.log(`      -> [긴급] "${f.title}": ${f.reason}`));

if (readiness.guardrailWarnings.length > 0) {
  readiness.guardrailWarnings.forEach(w => console.log(`      -> [가드레일 경고] ${w.message}`));
} else {
  console.log('   ✅ 가드레일: 현재 이동 경로는 주 복선 회수 궤도와 일치합니다.');
}

// 9. [T2b] Context Provider 확장 슬롯 검증
console.log('\n🧩 8. [T2b] Context Provider 확장 슬롯 검증...');

function expectThrow(label, fn, ErrorType, fragment) {
  let caught = null;
  try { fn(); } catch (e) { caught = e; }
  assert.ok(caught, `${label}: 예외가 발생해야 합니다`);
  assert.ok(caught instanceof ErrorType, `${label}: ${ErrorType.name} 이어야 합니다 (실제: ${caught.constructor.name})`);
  assert.ok(caught.message.includes(fragment), `${label}: 메시지에 '${fragment}' 포함 필요 (실제: ${caught.message})`);
}

function makeOrchestrator() {
  const o = new RuntimeOrchestrator({ worldGraph: world, logicCompiler: logic });
  o.registerCharacter(structuredClone(orchestrator.getCharacter('char_hero_01')));
  return o;
}

const FULL_SETUP = { involvedCharacterIds: ['char_hero_01', 'char_rogue_02'], locationId: 'loc_tavern' };
const HERO_SETUP = { involvedCharacterIds: ['char_hero_01'], locationId: 'loc_tavern' };

// 8-1. 하위 호환 + 결정론
const baseline = orchestrator.assemblePromptContext(FULL_SETUP);
assert.deepEqual(baseline.extensions, {}, 'provider 미등록 시 extensions 는 빈 객체여야 합니다');
assert.equal(orchestrator.listContextProviders().length, 0);

orchestrator.registerContextProvider('known-facts', (input) => ({
  lines: input.characters.flatMap(c => (c.known_facts || []).map(f => `${c.name} 앎: ${f}`)),
  data: { count: input.characters.reduce((n, c) => n + (c.known_facts || []).length, 0) }
}));

const withExt = orchestrator.assemblePromptContext(FULL_SETUP);
assert.ok(
  withExt.systemInstruction.startsWith(baseline.systemInstruction + '\n[EXT:known-facts]\n'),
  '기존 인스트럭션은 바이트 단위로 보존되고 확장 블록만 뒤에 붙어야 합니다'
);
assert.deepEqual(withExt.extensions['known-facts'].lines, ['에단 앎: 아버지가 숲 너머 제단에서 실종되었다는 소문']);
assert.equal(withExt.extensions['known-facts'].data.count, 1);
assert.equal(withExt.extensions._budget['known-facts'].mode, 'none');
const again = orchestrator.assemblePromptContext(FULL_SETUP);
assert.equal(JSON.stringify(again), JSON.stringify(withExt), '같은 상태에서는 같은 패킷이 나와야 합니다 (결정론)');
console.log('   ✅ 하위 호환·결정론: 기존 인스트럭션 보존, known-facts 확장 1줄 주입, 재조립 결과 동일');

// 8-2. 예산 절단
const budgetOrch = makeOrchestrator();
budgetOrch.registerContextProvider('overflow-soft', () => ({
  lines: ['짧은 줄 하나', '두 번째 줄', '이 줄은 예산을 넘기게 되는 아주 긴 세 번째 줄입니다']
}), { maxChars: 30 });
budgetOrch.registerContextProvider('overflow-hard', () => ({
  lines: ['ABCDEFGHIJKLMNOP']
}), { maxChars: 10 });
const budgetPacket = budgetOrch.assemblePromptContext(HERO_SETUP);
const soft = budgetPacket.extensions._budget['overflow-soft'];
const hard = budgetPacket.extensions._budget['overflow-hard'];
assert.deepEqual(budgetPacket.extensions['overflow-soft'].lines, ['짧은 줄 하나', '두 번째 줄']);
assert.deepEqual(soft, { maxChars: 30, usedChars: 14, totalLines: 3, keptLines: 2, mode: 'lines' });
assert.deepEqual(budgetPacket.extensions['overflow-hard'].lines, ['ABCDEFGHI…']);
assert.deepEqual(hard, { maxChars: 10, usedChars: 10, totalLines: 1, keptLines: 1, mode: 'hard' });
assert.ok(budgetPacket.systemInstruction.endsWith('[EXT:overflow-hard]\nABCDEFGHI…'));
console.log(`   ✅ 예산 절단: overflow-soft 줄 단위 ${soft.keptLines}/${soft.totalLines}줄(${soft.usedChars}/${soft.maxChars}자), overflow-hard 첫 줄 강제 절단(${hard.usedChars}/${hard.maxChars}자)`);

// 8-3. 거부 경로 7종
const ok = () => ({ lines: [] });
const dupOrch = makeOrchestrator();
dupOrch.registerContextProvider('known-facts', ok);
expectThrow('중복 이름', () => dupOrch.registerContextProvider('known-facts', ok), Error, '이미 등록된');
expectThrow('이름 형식', () => makeOrchestrator().registerContextProvider('Known_Facts', ok), TypeError, '이름 형식');
expectThrow('async 금지', () => makeOrchestrator().registerContextProvider('async-provider', async () => ({ lines: [] })), TypeError, '동기 순수 함수');
expectThrow('maxChars 하한', () => makeOrchestrator().registerContextProvider('tiny', ok, { maxChars: 9 }), RangeError, 'maxChars');

const mutOrch = makeOrchestrator();
mutOrch.registerContextProvider('mutator', (input) => { input.characters[0].physical.hp = 0; return { lines: [] }; });
expectThrow('입력 변조', () => mutOrch.assemblePromptContext(HERO_SETUP), TypeError, "'mutator'");
assert.equal(mutOrch.getCharacter('char_hero_01').physical.hp, orchestrator.getCharacter('char_hero_01').physical.hp, '변조 시도 후에도 원본 상태는 그대로여야 합니다');

const badOrch = makeOrchestrator();
badOrch.registerContextProvider('bad-shape', () => ({ lines: '한 줄' }));
expectThrow('반환 형식', () => badOrch.assemblePromptContext(HERO_SETUP), TypeError, '반환 형식');

const promiseOrch = makeOrchestrator();
promiseOrch.registerContextProvider('sneaky-promise', () => Promise.resolve({ lines: [] }));
expectThrow('Promise 반환', () => promiseOrch.assemblePromptContext(HERO_SETUP), TypeError, 'Promise');
console.log('   ✅ 거부 경로 7종: 중복 이름, 이름 형식, async, maxChars 하한, 입력 변조, 반환 형식, Promise 반환');

// 10. [T3] conspiracy-truth-ledger: 진실/믿음/소문 분리, 누수 방지, 봉인 해제 검증
import { TruthLedger } from '../builders/conspiracy-truth-ledger/index.js'; // ESM import 는 모듈 최상단으로 호이스팅됨

console.log('\n🕯️ 9. [T3] 진실 원장: 소문 전파, 누수 방지, 봉인 해제 검증...');

const TRUTH = '아버지는 제단의 봉인을 지키기 위해 스스로 돌이 되었다';
const RUMOR_TAVERN = '아버지는 빚을 지고 도망쳤다';

function buildLedgerScenario() {
  const lc = new NarrativeLogicCompiler(world);
  lc.registerForeshadow({
    id: 'gun_001_pendant',
    title: '피 묻은 가문의 펜던트',
    status: 'planted',
    planted_scene: 'scene_001',
    neglect_count: 0,
    max_neglect_threshold: 2,
    target_milestone: { required_location: 'loc_ancient_altar', involved_characters: ['char_hero_01'] }
  });
  const ledger = new TruthLedger({ worldGraph: world, logicCompiler: lc });
  ledger.registerFact({
    id: 'fact_father_fate',
    truth: TRUTH,
    rumor_variants: ['아버지가 제단에서 무언가를 지키다 사라졌다', '아버지가 숲에서 짐승에게 당했다', RUMOR_TAVERN],
    seal: { all: [
      { type: 'location', value: 'loc_ancient_altar' },
      { type: 'present', value: ['char_hero_01'] },
      { type: 'foreshadow_status', id: 'gun_001_pendant', statuses: ['triggered', 'resolved'] }
    ] }
  });
  const reached = ledger.spreadRumor({ factId: 'fact_father_fate', originLocationId: 'loc_ancient_altar', elapsedHours: 7 });
  ledger.hearRumors('char_hero_01', 'loc_tavern', 3);
  ledger.hearRumors('char_rogue_02', 'loc_tavern', 3);

  const o = new RuntimeOrchestrator({ worldGraph: world, logicCompiler: lc });
  o.registerCharacter(structuredClone(orchestrator.getCharacter('char_hero_01')));
  o.registerCharacter(structuredClone(orchestrator.getCharacter('char_rogue_02')));
  o.registerContextProvider('truth-ledger', ledger.createContextProvider(), { maxChars: 240 });
  return { lc, ledger, reached, o };
}

// 9-1. 소문 전파 + 누수 방지 + 결정론
const s = buildLedgerScenario();
assert.deepEqual(
  s.reached.map(r => [r.locationId, r.hops, r.variant_index]),
  [['loc_tavern', 2, 2], ['loc_forest_entrance', 1, 1], ['loc_ancient_altar', 0, 0]]
);
const tavernPacket = s.o.assemblePromptContext(FULL_SETUP);
assert.deepEqual(tavernPacket.extensions['truth-ledger'].lines, [
  `에단 믿음: "${RUMOR_TAVERN}" (확신 40, 소문)`,
  `로웬 믿음: "${RUMOR_TAVERN}" (확신 40, 소문)`
]);
assert.ok(!JSON.stringify(tavernPacket).includes(TRUTH), '봉인된 진실이 패킷에 새면 안 됩니다');
assert.ok(!JSON.stringify(tavernPacket).includes('is_true'), '참/거짓 판정이 패킷에 새면 안 됩니다');
const tavernAgain = buildLedgerScenario().o.assemblePromptContext(FULL_SETUP);
assert.equal(JSON.stringify(tavernAgain), JSON.stringify(tavernPacket), '같은 시나리오는 같은 패킷 (결정론)');
console.log('   ✅ 소문 전파: 제단(원본)→숲 어귀(1홉, 변형 1)→주점(2홉, 변형 2), 주점 패킷엔 왜곡된 소문만, 진실 누수 0, 결정론 동일');

// 9-2. 봉인 해제 (복선 미발동 → 거부, triggered → 해제)
const ALTAR_CTX = { sceneIndex: 4, locationId: 'loc_ancient_altar', presentCharacterIds: ['char_hero_01'] };
const pending = s.ledger.evaluateSeals(ALTAR_CTX);
assert.equal(pending.length, 1);
assert.equal(pending[0].satisfied, false);
assert.equal(pending[0].unmet.length, 1, '장소·동석은 충족, 복선 상태만 미충족이어야 합니다');
expectThrow('봉인 미충족 해제', () => s.ledger.unseal('fact_father_fate', ALTAR_CTX), Error, '봉인 조건 미충족');
expectThrow('봉인 진실 직접 주입', () => s.ledger.plantBelief('char_rogue_02', {
  fact_id: 'fact_father_fate', version: 'truth', confidence: 90, source: 'told', scene: 4
}), Error, '봉인된 진실');

s.lc.transitionStatus('gun_001_pendant', 'triggered');
assert.deepEqual(s.ledger.unseal('fact_father_fate', ALTAR_CTX).revealedTo, ['char_hero_01']);
const altarPacket = s.o.assemblePromptContext({ involvedCharacterIds: ['char_hero_01', 'char_rogue_02'], locationId: 'loc_ancient_altar' });
assert.deepEqual(altarPacket.extensions['truth-ledger'].lines, [
  `에단 믿음: "${TRUTH}" (확신 100, 확인)`,
  `로웬 믿음: "${RUMOR_TAVERN}" (확신 40, 소문)`
]);
assert.ok(!JSON.stringify(altarPacket).includes('is_true'));
console.log('   ✅ 봉인 해제: 복선 미발동 시 거부 → triggered 후 해제, 에단만 진실 확인(100), 로웬은 소문 유지');

// 9-3. 거부 경로
expectThrow('중복 fact', () => s.ledger.registerFact({ id: 'fact_father_fate', truth: 'x', rumor_variants: ['y'] }), Error, '이미 등록된');
expectThrow('줄바꿈 금지', () => s.ledger.registerFact({ id: 'fact_newline', truth: '첫 줄\n둘째 줄', rumor_variants: ['y'] }), TypeError, '줄바꿈');
expectThrow('그래프 없는 전파', () => new TruthLedger().spreadRumor({ factId: 'x', originLocationId: 'loc_tavern', elapsedHours: 1 }), Error, 'worldGraph');
expectThrow('이중 해제', () => s.ledger.unseal('fact_father_fate', ALTAR_CTX), Error, '이미 해제');
console.log('   ✅ 거부 경로 6종: 봉인 미충족 해제, 봉인 진실 직접 주입, 중복 fact, 줄바꿈, 그래프 없는 전파, 이중 해제');

// 11. [T3.5] 유리관 미로 가드레일: 탈선 경고, 도달 불가, 허용치 경계 검증 (별도 그래프)
console.log('\n🧭 10. [T3.5] 유리관 미로 가드레일 탈선 판정 검증...');

const gEdge = (to, hours) => ({ target_node_id: to, travel_cost_hours: hours, danger_level: 2 });
const gWorld = new WorldGraphBuilder();
gWorld.addLocation({ id: 'g_hub', name: '교차로 마을', zone_type: 'settlement',
  connected_edges: [gEdge('g_altar', 4), gEdge('g_camp', 10), gEdge('g_port', 30), gEdge('g_cliff', 3)] });
gWorld.addLocation({ id: 'g_altar', name: '봉인의 제단', zone_type: 'sacred', connected_edges: [gEdge('g_hub', 4)] });
gWorld.addLocation({ id: 'g_camp', name: '사냥꾼 야영지', zone_type: 'wilderness', connected_edges: [gEdge('g_hub', 10)] });
gWorld.addLocation({ id: 'g_port', name: '먼 항구', zone_type: 'transit', connected_edges: [gEdge('g_hub', 30)] });
gWorld.addLocation({ id: 'g_cliff', name: '돌아올 수 없는 절벽', zone_type: 'wilderness', connected_edges: [] }); // 일방통행 종점
gWorld.addLocation({ id: 'g_island', name: '고립된 섬', zone_type: 'dungeon', connected_edges: [] });           // 완전 고립

const gLogic = new NarrativeLogicCompiler(gWorld);
gLogic.registerForeshadow({
  id: 'gun_g_relic',
  title: '제단의 유물',
  status: 'planted',
  planted_scene: 'scene_g01',
  neglect_count: 0,
  max_neglect_threshold: 1,
  target_milestone: { required_location: 'g_altar', involved_characters: [] }
});
gLogic.tickScene([]); // 1씬 방치 -> 긴급 복선, 제단이 필수 경유지가 됨

const judge = (dest, max) => gLogic.evaluateSceneReadiness({
  currentLocation: 'g_hub',
  plannedDestination: dest,
  ...(max === undefined ? {} : { maxAllowedDeviationHours: max })
});
const warnTypes = (r) => r.guardrailWarnings.map(w => w.type);

// 10-1. 기본 궤도: 복선 장소 직행(-4h), 허용치 내 우회(+10h)
const onTrack = judge('g_altar');
assert.equal(onTrack.urgentForeshadows.length, 1, '긴급 복선 1개가 경유지를 공급해야 합니다');
assert.deepEqual(warnTypes(onTrack), []);
assert.equal(onTrack.isDivergent, false);
assert.deepEqual(warnTypes(judge('g_camp')), [], '+10h 는 기본 허용치 24h 이내');
console.log('   ✅ 기본 궤도: 제단 직행·야영지 우회(+10h) 모두 경고 없음');

// 10-2. 탈선 경고: 항구(+30h > 24h)
const offTrack = judge('g_port');
assert.equal(offTrack.isDivergent, true);
assert.equal(offTrack.guardrailWarnings.length, 1);
const div = offTrack.guardrailWarnings[0];
assert.equal(div.type, 'TRAJECTORY_DIVERGENCE');
assert.equal(div.severity, 'medium');
assert.equal(div.milestone, 'g_altar');
assert.equal(div.addedHours, 30);
console.log(`   ✅ 탈선 경고: 항구행 ${div.type}(${div.severity}), 경유지 이동 +${div.addedHours}h`);

// 10-3. 경계값: 우회 10h 기준, 허용치 10 이면 통과(초과만 경고), 9 면 경고
assert.deepEqual(warnTypes(judge('g_camp', 10)), [], '허용치와 같으면 경고 없음 (> 비교)');
const tight = judge('g_camp', 9);
assert.deepEqual(warnTypes(tight), ['TRAJECTORY_DIVERGENCE']);
assert.equal(tight.guardrailWarnings[0].addedHours, 10);
console.log('   ✅ 경계값: 우회 10h 에서 허용치 10 통과, 허용치 9 경고');

// 10-4. 도달 불가: 고립된 섬, 미등록 장소 (high, 즉시 반환)
for (const dest of ['g_island', 'g_nowhere']) {
  const r = judge(dest);
  assert.equal(r.isDivergent, true);
  assert.deepEqual(warnTypes(r), ['UNREACHABLE_DESTINATION']);
  assert.equal(r.guardrailWarnings[0].severity, 'high');
}
console.log('   ✅ 도달 불가: 고립된 섬·미등록 장소 모두 UNREACHABLE_DESTINATION(high)');

// 10-5. 결함 수정 검증
const zeroTolerance = judge('g_camp', 0);
assert.deepEqual(warnTypes(zeroTolerance), ['TRAJECTORY_DIVERGENCE'], '허용치 0 지정 시 우회 경로 경고해야 합니다');
assert.equal(zeroTolerance.guardrailWarnings[0].addedHours, 10);
const oneWay = judge('g_cliff');
assert.deepEqual(warnTypes(oneWay), ['ONE_WAY_TRAP'], '일방통행 목적지는 ONE_WAY_TRAP 경고해야 합니다');
assert.equal(oneWay.isDivergent, true);
console.log('   ✅ 결함 수정: 허용치 0 지정 가능, 일방통행 탈선 감지(ONE_WAY_TRAP)');

// 11. [T4] Global Clock: 다중 캐릭터 시뮬레이션을 위한 글로벌 시계
console.log('\n⏰ 11. [T4] Global Clock: 글로벌 시계, 로컬 시간, 스냅샷 검증...');

const clock = new GlobalClock();

// 11-1. 기본 초기화 및 틱 전진
clock.initialize({ startHour: 0, tickDurationHours: 1 });
assert.equal(clock.getCurrentTime(), 0, '초기 시간은 0이어야 합니다');
clock.advance(5);
assert.equal(clock.getCurrentTime(), 5, '5틱 전진 후 5시간이어야 합니다');
console.log('   ✅ 기본 초기화 및 틱 전진: 0시간 → 5시간');

// 11-2. 캐릭터 등록 및 로컬 시간
clock.registerCharacter('char_hero_01');
clock.registerCharacter('char_rogue_02');
assert.equal(clock.getLocalTime('char_hero_01'), 5, '등록 시점 현재 글로벌 시간으로 초기화');
assert.equal(clock.getLocalTime('char_rogue_02'), 5, '등록 시점 현재 글로벌 시간으로 초기화');
console.log('   ✅ 캐릭터 등록: 로컬 시간이 글로벌 시간과 동기화');

// 11-3. 로컬 시간 조정 (이동/행동 시 사용)
clock.adjustLocalTime('char_hero_01', 2); // 에단은 2시간 추가 경험 (이동 중)
assert.equal(clock.getLocalTime('char_hero_01'), 7, '로컬 시간 조정 후 7시간');
assert.equal(clock.getLocalTime('char_rogue_02'), 5, '다른 캐릭터 시간은 변화 없음');
assert.equal(clock.getTimeDivergence('char_hero_01'), 2, '시간 왜곡도 2시간');
assert.equal(clock.getTimeDivergence('char_rogue_02'), 0, '다른 캐릭터 시간 왜곡도 0');
console.log('   ✅ 로컬 시간 조정: 에단 +2시간, 로웬 변화 없음, 왜곡도 계산');

// 11-4. 틱 전진 시 모든 캐릭터 로컬 시간도 전진
clock.advance(3);
assert.equal(clock.getCurrentTime(), 8, '글로벌 시간 8시간');
assert.equal(clock.getLocalTime('char_hero_01'), 10, '에단 로컬 시간 10시간 (7 + 3)');
assert.equal(clock.getLocalTime('char_rogue_02'), 8, '로웬 로컬 시간 8시간 (5 + 3)');
console.log('   ✅ 틱 전진: 글로벌 8시간, 에단 10시간, 로웬 8시간');

// 11-5. 스냅샷 생성 및 복원
const snapId = clock.createSnapshot('before_battle');
const snapshot = clock.listSnapshots()[0];
assert.equal(snapshot.id, snapId, '스냅샷 ID 일치');
assert.equal(snapshot.globalTime, 8, '스냅샷 시간 8시간');
console.log('   ✅ 스냅샷 생성: before_battle 라벨로 저장');

clock.advance(10);
assert.equal(clock.getCurrentTime(), 18, '전진 후 18시간');
clock.restoreSnapshot(snapId);
assert.equal(clock.getCurrentTime(), 8, '복원 후 8시간');
assert.equal(clock.getLocalTime('char_hero_01'), 10, '에단 로컬 시간도 복원');
console.log('   ✅ 스냅샷 복원: 18시간 → 8시간으로 되돌아감');

// 11-6. 거부 경로
assert.throws(() => clock.registerCharacter('char_hero_01'), Error, '중복 등록 거부');
assert.throws(() => clock.advance(-1), RangeError, '음수 틱 거부');
assert.throws(() => clock.adjustLocalTime('char_unknown', 1), Error, '미등록 캐릭터 조정 거부');
assert.throws(() => clock.adjustLocalTime('char_hero_01', -100), RangeError, '음수 로컬 시간 거부');
assert.throws(() => clock.restoreSnapshot('unknown'), Error, '존재하지 않는 스냅샷 복원 거부');
console.log('   ✅ 거부 경로 5종: 중복 등록, 음수 틱, 미등록 조정, 음수 로컬 시간, 존재하지 않는 스냅샷');

// 11-7. 상태 내보내기/가져오기
const exported = clock.exportState();
assert.equal(exported.globalTime, 8);
assert.equal(exported.characters.length, 2);
const newClock = new GlobalClock();
newClock.importState(exported);
assert.equal(newClock.getCurrentTime(), 8);
assert.equal(newClock.getLocalTime('char_hero_01'), 10);
console.log('   ✅ 상태 내보내기/가져오기: 직렬화/역직렬화 완료');

// 12. [T4.1] Multi-Character Sim: 다중 캐릭터 병렬 시뮬레이션
console.log('\n👥 12. [T4.1] Multi-Character Sim: 병렬 상태 업데이트, 우선순위, 조우 감지 검증...');

const multiSim = new MultiCharacterSim();
const mClock = new GlobalClock();
const mWorld = new WorldGraphBuilder();

// 테스트용 월드 그래프
mWorld.addLocation({
  id: 'loc_tavern',
  name: '주점',
  zone_type: 'settlement',
  connected_edges: [{ target_node_id: 'loc_forest', travel_cost_hours: 2, danger_level: 2 }]
});
mWorld.addLocation({
  id: 'loc_forest',
  name: '숲',
  zone_type: 'wilderness',
  connected_edges: [{ target_node_id: 'loc_tavern', travel_cost_hours: 2, danger_level: 2 }]
});
mWorld.addLocation({
  id: 'loc_castle',
  name: '성',
  zone_type: 'settlement',
  connected_edges: []
});

multiSim.initialize({ globalClock: mClock, worldGraph: mWorld });

// 12-1. 캐릭터 등록
multiSim.registerCharacter({
  id: 'char_hero_01',
  name: '에단',
  role: 'protagonist',
  currentLocation: 'loc_tavern',
  physical: { hp: 100, hunger: 0, stamina: 100 },
  psychological: { dominant_emotion: 'neutral', stress: 0 }
});
multiSim.registerCharacter({
  id: 'char_rogue_02',
  name: '로웬',
  role: 'supporting',
  currentLocation: 'loc_tavern',
  physical: { hp: 90, hunger: 0, stamina: 90 },
  psychological: { dominant_emotion: 'cunning', stress: 10 }
});
multiSim.registerCharacter({
  id: 'char_villain_01',
  name: '카르타고',
  role: 'antagonist',
  currentLocation: 'loc_castle',
  physical: { hp: 100, hunger: 0, stamina: 100 },
  psychological: { dominant_emotion: 'hostile', stress: 0 }
});
console.log('   ✅ 캐릭터 등록: 주인공, 조력자, 적대자');

// 12-2. 우선순위 확인
assert.equal(multiSim.getPriority('char_hero_01'), 10, '주인공 우선순위 10');
assert.equal(multiSim.getPriority('char_rogue_02'), 8, '조력자 우선순위 8');
assert.equal(multiSim.getPriority('char_villain_01'), 7, '적대자 우선순위 7');
console.log('   ✅ 우선순위: 주인공(10) > 조력자(8) > 적대자(7)');

// 12-3. 틱 전진 (행동 없음)
const result1 = multiSim.advanceTick({ globalDelta: 1, characterActions: [] });
assert.equal(result1.advancedCharacters.length, 3, '모든 캐릭터 처리');
assert.equal(result1.encounters.length, 1, '주점에 2명 있으므로 조우 1개');
assert.equal(result1.encounters[0].location, 'loc_tavern');
assert.deepEqual(result1.encounters[0].participants.sort(), ['char_hero_01', 'char_rogue_02']);
console.log('   ✅ 틱 전진: 모든 캐릭터 처리, 주점 조우 감지');

// 12-4. 이동 처리
const result2 = multiSim.advanceTick({
  globalDelta: 1,
  characterActions: [
    { characterId: 'char_hero_01', action: 'move', target: 'loc_forest' },
    { characterId: 'char_rogue_02', action: 'wait' },
    { characterId: 'char_villain_01', action: 'wait' }
  ]
});
const heroAfterMove = multiSim.getCharacter('char_hero_01');
assert.equal(heroAfterMove.currentLocation, 'loc_forest', '에단 이동 완료');
assert.equal(heroAfterMove.physical.stamina, 96, '이동으로 체력 소모 (100 - 2*2)');
assert.equal(heroAfterMove.physical.hunger, 6, '이동으로 허기 증가 (0 + 2*3)');
assert.equal(mClock.getTimeDivergence('char_hero_01'), 2, '에단 로컬 시간 2시간 추가');
console.log('   ✅ 이동 처리: 에단 숲으로 이동, 체력/허기 변화, 로컬 시간 조정');

// 12-5. 위치 기반 그룹핑 (조우 감지)
const result3 = multiSim.advanceTick({ globalDelta: 1, characterActions: [] });
assert.equal(result3.encounters.length, 0, '각 장소에 캐릭터 1명씩만 있으므로 조우 없음');
console.log('   ✅ 조우 감지: 각 장소에 캐릭터 1명씩만 있으므로 조우 없음');

// 12-5b. 캐릭터가 같은 장소로 모이면 조우 감지
const result3b = multiSim.advanceTick({
  globalDelta: 1,
  characterActions: [
    { characterId: 'char_hero_01', action: 'move', target: 'loc_tavern' }
  ]
});
assert.equal(result3b.encounters.length, 1, '에단이 주점으로 돌아오면 조우 발생');
assert.equal(result3b.encounters[0].location, 'loc_tavern');
assert.deepEqual(result3b.encounters[0].participants.sort(), ['char_hero_01', 'char_rogue_02']);
console.log('   ✅ 조우 감지: 에단 주점 복귀 시 로웬과 조우');

// 12-6. 캐릭터 상태 조회
const tavernChars = multiSim.getCharactersAtLocation('loc_tavern');
assert.equal(tavernChars.length, 2, '주점에 에단과 로웬');
assert.deepEqual(tavernChars.map(c => c.id).sort(), ['char_hero_01', 'char_rogue_02']);
const allChars = multiSim.getAllCharacters();
assert.equal(allChars.length, 3);
console.log('   ✅ 상태 조회: 장소별 캐릭터, 전체 캐릭터');

// 12-7. 스냅샷 생성 (복원 테스트는 생략 - 복잡성으로 인해 추후 개선)
const simSnapId = multiSim.createSnapshot('before_climax');
const simSnapshot = multiSim.listSnapshots()[0];
assert.equal(simSnapshot.id, simSnapId);
assert.equal(mClock.getCurrentTime(), 4, '스냅샷 생성 시간 4시간');
console.log('   ✅ 스냅샷 생성: before_climax 라벨로 저장');

// 12-8. 거부 경로
assert.throws(() => multiSim.registerCharacter({ id: 'char_hero_01' }), Error, '중복 등록 거부');
assert.throws(() => multiSim.getCharacter('unknown'), Error, '미등록 캐릭터 조회 거부');
assert.throws(() => multiSim.initialize({ globalClock: null }), Error, 'GlobalClock 미초기화 거부');
console.log('   ✅ 거부 경로 3종: 중복 등록, 미등록 조회, 미초기화');

// 12-9. 상태 내보내기/가져오기
const simExported = multiSim.exportState();
assert.equal(simExported.globalTime, 4);
assert.equal(simExported.characters.length, 3);
const newMultiSim = new MultiCharacterSim();
newMultiSim.initialize({ globalClock: mClock, worldGraph: mWorld });
newMultiSim.importState(simExported);
assert.equal(newMultiSim.getCharacter('char_hero_01').currentLocation, 'loc_tavern');
console.log('   ✅ 상태 내보내기/가져오기: 직렬화/역직렬화 완료');

console.log('\n\x1b[32m%s\x1b[0m', '🎉 [SUCCESS] 6대 코어 빌더가 완벽한 인과관계로 연결되어 정상 구동됨을 입증했습니다.');
