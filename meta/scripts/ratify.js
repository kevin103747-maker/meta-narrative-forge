import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();
const LEDGER_PATH = path.join(ROOT_DIR, 'meta', 'ledger', 'registry-state.json');
const CONSTITUTION_REL = 'system/CONSTITUTION.md';

// [동기화 필수] meta/scripts/audit.js 의 GOVERNANCE_FILES 와 반드시 동일해야 한다.
const GOVERNANCE_FILES = [
  'meta/scripts/audit.js',
  'meta/scripts/freeze.js',
  'meta/scripts/ratify.js',
  'meta/contracts/module-contract.template.json',
  'package.json'
];

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fail(msg) {
  console.error('\x1b[31m%s\x1b[0m', `❌ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--approved-by') args.approvedBy = argv[++i];
    else if (argv[i] === '--reason') args.reason = argv[++i];
    else fail(`알 수 없는 인자: ${argv[i]}`);
  }
  return args;
}

function ratify() {
  const { approvedBy, reason = '' } = parseArgs(process.argv.slice(2));
  if (!approvedBy || !approvedBy.trim() || approvedBy.startsWith('--')) {
    fail('승인자를 지정하십시오. 예: npm run ratify -- --approved-by kevin --reason "T1 거버넌스 패치"');
  }
  if (!fs.existsSync(LEDGER_PATH)) fail('동결 장부가 없습니다: meta/ledger/registry-state.json');

  let ledger;
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
  } catch (e) {
    fail(`장부 파싱 실패: ${e.message}`);
  }

  const changes = [];

  const constitutionHash = getFileHash(path.join(ROOT_DIR, CONSTITUTION_REL));
  if (!constitutionHash) fail(`헌법 파일이 없습니다: ${CONSTITUTION_REL}`);
  if (ledger.system_constitution_hash !== constitutionHash) {
    changes.push({ file: CONSTITUTION_REL, from: ledger.system_constitution_hash || null, to: constitutionHash });
  }

  const prevGov = ledger.governance_files || {};
  const nextGov = {};
  for (const rel of GOVERNANCE_FILES) {
    const h = getFileHash(path.join(ROOT_DIR, rel));
    if (!h) fail(`거버넌스 파일이 없습니다: ${rel}`);
    nextGov[rel] = h;
    if (prevGov[rel] !== h) changes.push({ file: rel, from: prevGov[rel] || null, to: h });
  }
  for (const rel of Object.keys(prevGov)) {
    if (!(rel in nextGov)) changes.push({ file: rel, from: prevGov[rel], to: null });
  }

  if (changes.length === 0) {
    console.log('\x1b[32m%s\x1b[0m', '✅ 변경 사항 없음: 헌법과 거버넌스 파일이 이미 비준된 상태와 일치합니다.');
    process.exit(0);
  }

  console.log('\x1b[33m%s\x1b[0m', `>>> [ratify] 승인자: ${approvedBy.trim()}`);
  for (const c of changes) {
    const from = c.from ? c.from.substring(0, 8) : '(신규)';
    const to = c.to ? c.to.substring(0, 8) : '(제거)';
    console.log(`📜 ${c.file}: ${from} -> ${to}`);
  }

  const entry = {
    ratified_at: new Date().toISOString(),
    approved_by: approvedBy.trim(),
    reason,
    changes
  };

  const nextLedger = {
    system_constitution_hash: constitutionHash,
    governance_files: nextGov,
    frozen_modules: ledger.frozen_modules || {},
    ratification_log: [...(ledger.ratification_log || []), entry]
  };
  for (const [k, v] of Object.entries(ledger)) {
    if (!(k in nextLedger)) nextLedger[k] = v;
  }

  fs.writeFileSync(LEDGER_PATH, JSON.stringify(nextLedger, null, 2), 'utf-8');

  console.log('--------------------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', `✅ 비준 완료: ${changes.length}개 항목이 장부에 기록되었습니다.`);
  console.log('   ※ 동결 모듈 무결성은 비준 대상이 아닙니다. 이어서 npm run audit 를 실행하십시오.');
}

ratify();
