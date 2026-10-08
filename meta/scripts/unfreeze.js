import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const LEDGER_PATH = path.join(ROOT_DIR, 'meta', 'ledger', 'registry-state.json');
const BUILDERS_DIR = path.join(ROOT_DIR, 'builders');
const AUDIT_SCRIPT = path.join(ROOT_DIR, 'meta', 'scripts', 'audit.js');
const USAGE = 'npm run unfreeze -- <모듈명> --approved-by <이름> --reason "<사유>" [--yes]';

function fail(msg) {
  console.error('\x1b[31m%s\x1b[0m', `❌ 에러: ${msg}`);
  process.exit(1);
}

function runAudit(stage) {
  console.log('\x1b[36m%s\x1b[0m', `>>> [unfreeze] ${stage} 감사 실행...`);
  const result = spawnSync(process.execPath, [AUDIT_SCRIPT], { cwd: ROOT_DIR, stdio: 'inherit' });
  return result.status === 0;
}

function parseArgs(argv) {
  const args = { yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--approved-by') args.approvedBy = argv[++i];
    else if (a === '--reason') args.reason = argv[++i];
    else if (a === '--yes') args.yes = true;
    else if (a.startsWith('--')) fail(`알 수 없는 인자: ${a}`);
    else if (!args.moduleName) args.moduleName = a;
    else fail(`모듈은 하나만 지정할 수 있습니다: ${a}`);
  }
  return args;
}

function depNameOf(raw) {
  return String(raw).replace(/^@\//, '').replace(/\/+$/, '').replace(/^builders\//, '');
}

function depsOf(contract) {
  return (contract.dependencies?.internal_modules || []).map(depNameOf);
}

function loadContracts() {
  const map = new Map();
  const names = fs.readdirSync(BUILDERS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  for (const name of names) {
    const p = path.join(BUILDERS_DIR, name, 'contract.json');
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf-8');
    map.set(name, { path: p, raw, data: JSON.parse(raw) });
  }
  return map;
}

// 대상 모듈 + 직·간접 의존하는 모든 FROZEN 모듈
function computeCascade(root, contracts) {
  const order = [root];
  const seen = new Set([root]);
  for (let i = 0; i < order.length; i++) {
    const cur = order[i];
    for (const [name, c] of contracts) {
      if (seen.has(name) || c.data.status !== 'FROZEN') continue;
      if (depsOf(c.data).includes(cur)) {
        seen.add(name);
        order.push(name);
      }
    }
  }
  return order;
}

// 재동결 권장 순서 (의존 대상이 먼저)
function freezeOrder(cascade, contracts) {
  const set = new Set(cascade);
  const done = [];
  const doneSet = new Set();
  while (done.length < cascade.length) {
    const next = cascade.find(n =>
      !doneSet.has(n) &&
      depsOf(contracts.get(n).data).filter(d => set.has(d)).every(d => doneSet.has(d))
    );
    if (!next) break;
    done.push(next);
    doneSet.add(next);
  }
  return done;
}

function unfreeze() {
  const { moduleName, approvedBy, reason, yes } = parseArgs(process.argv.slice(2));
  if (!moduleName) fail(`모듈 이름을 지정하십시오. 사용법: ${USAGE}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(moduleName)) fail(`모듈 이름 형식 오류: '${moduleName}'`);
  if (!approvedBy || !approvedBy.trim() || approvedBy.startsWith('--')) fail(`승인자를 지정하십시오. 사용법: ${USAGE}`);
  if (!reason || !reason.trim() || reason.startsWith('--')) fail(`사유를 지정하십시오. 사용법: ${USAGE}`);

  if (!runAudit('사전')) fail('사전 감사 실패. 동결 해제를 중단합니다.');

  const contracts = loadContracts();
  const target = contracts.get(moduleName);
  if (!target) fail(`모듈 계약서를 찾을 수 없습니다: builders/${moduleName}/contract.json`);
  if (target.data.status !== 'FROZEN') fail(`[${moduleName}] 은(는) 동결 상태가 아닙니다 (status: ${target.data.status}).`);

  const cascade = computeCascade(moduleName, contracts);

  console.log('--------------------------------------------------');
  console.log('\x1b[33m%s\x1b[0m', `>>> [unfreeze] 동결 해제 계획 (대상: ${moduleName}, 총 ${cascade.length}개 모듈)`);
  for (const name of cascade) {
    const tag = name === moduleName ? '대상' : '연쇄';
    console.log(`   🔓 [${tag}] ${name} (v${contracts.get(name).data.version ?? '?'})`);
  }
  console.log(`   승인자: ${approvedBy.trim()} / 사유: ${reason.trim()}`);

  if (!yes) {
    console.log('--------------------------------------------------');
    console.log('\x1b[36m%s\x1b[0m', 'ℹ️  시험 실행(dry-run)입니다. 아무것도 변경되지 않았습니다.');
    console.log('   실제로 해제하려면 동일한 명령에 --yes 를 추가하십시오.');
    process.exit(0);
  }

  const ledgerRaw = fs.readFileSync(LEDGER_PATH, 'utf-8');
  const ledger = JSON.parse(ledgerRaw);
  ledger.frozen_modules = ledger.frozen_modules || {};
  const superseded = Array.isArray(ledger.superseded_modules) ? ledger.superseded_modules : [];
  const now = new Date().toISOString();

  const rollback = () => {
    fs.writeFileSync(LEDGER_PATH, ledgerRaw, 'utf-8');
    for (const name of cascade) {
      const c = contracts.get(name);
      fs.writeFileSync(c.path, c.raw, 'utf-8');
    }
  };

  try {
    for (const name of cascade) {
      const c = contracts.get(name);
      const prefix = `builders/${name}/`;
      const files = {};
      for (const [k, v] of Object.entries(ledger.frozen_modules)) {
        if (k.startsWith(prefix)) files[k] = v;
      }
      if (Object.keys(files).length === 0) throw new Error(`장부에 동결 해시가 없습니다: ${name}`);
      for (const k of Object.keys(files)) delete ledger.frozen_modules[k];

      superseded.push({
        module: name,
        version: c.data.version ?? null,
        frozen_at: c.data.frozen_at ?? null,
        unfrozen_at: now,
        approved_by: approvedBy.trim(),
        reason: reason.trim(),
        cascade_root: moduleName,
        files
      });

      const next = { ...c.data, status: 'DRAFT' };
      delete next.frozen_at;
      fs.writeFileSync(c.path, JSON.stringify(next, null, 2), 'utf-8');
      console.log(`🔓 [UNLOCKED] ${name} -> 해시 ${Object.keys(files).length}개를 superseded_modules 로 이관`);
    }
    ledger.superseded_modules = superseded;
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf-8');
  } catch (e) {
    rollback();
    fail(`동결 해제 중 예외 발생, 원상 복구함: ${e.message}`);
  }

  if (!runAudit('사후')) {
    rollback();
    fail('사후 감사 실패. 장부와 계약서를 해제 이전 상태로 복구했습니다.');
  }

  console.log('--------------------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', `✅ ${cascade.length}개 모듈이 DRAFT 로 전환되었습니다. 이전 해시는 superseded_modules 에 보존되었습니다.`);
  console.log(`   재동결 시 각 모듈의 version 을 올린 뒤 다음 순서로 freeze 하십시오: ${freezeOrder(cascade, contracts).join(' -> ')}`);
}

unfreeze();
