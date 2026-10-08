import assert from 'node:assert/strict';
import { WorldGraphBuilder } from '../builders/world-graph-builder/index.js';
import { NarrativeLogicCompiler } from '../builders/narrative-logic-compiler/index.js';
import { RuntimeOrchestrator } from '../builders/runtime-orchestrator/index.js';

console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log('\x1b[35m%s\x1b[0m', '🚀 [meta-narrative-forge] 4대 코어 빌더 통합 구동 테스트');
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

console.log('\n\x1b[32m%s\x1b[0m', '🎉 [SUCCESS] 4대 코어 빌더가 완벽한 인과관계로 연결되어 정상 구동됨을 입증했습니다.');
