import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const LEDGER_PATH = path.join(ROOT_DIR, 'meta', 'ledger', 'registry-state.json');
const BUILDERS_DIR = path.join(ROOT_DIR, 'builders');
const AUDIT_SCRIPT = path.join(ROOT_DIR, 'meta', 'scripts', 'audit.js');

function getFileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fail(msg) {
  console.error('\x1b[31m%s\x1b[0m', `❌ 에러: ${msg}`);
  process.exit(1);
}

function runAudit(stage) {
  console.log('\x1b[36m%s\x1b[0m', `>>> [freeze] ${stage} 감사 실행...`);
  const result = spawnSync(process.execPath, [AUDIT_SCRIPT], { cwd: ROOT_DIR, stdio: 'inherit' });
  return result.status === 0;
}

function freezeModule(moduleName) {
  if (!moduleName) fail('동결할 모듈 이름을 지정하십시오. 예: npm run freeze schema-factory');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(moduleName)) {
    fail(`모듈 이름 형식 오류: '${moduleName}' (소문자, 숫자, 하이픈만 허용)`);
  }

  const modulePath = path.join(BUILDERS_DIR, moduleName);
  const contractPath = path.join(modulePath, 'contract.json');
  if (!fs.existsSync(modulePath)) fail(`모듈 디렉터리를 찾을 수 없습니다: builders/${moduleName}`);
  if (!fs.existsSync(contractPath)) fail(`contract.json 계약서가 없습니다: builders/${moduleName}/contract.json`);

  if (!runAudit('사전')) fail('사전 감사 실패. 동결을 중단합니다.');

  const ledgerRaw = fs.readFileSync(LEDGER_PATH, 'utf-8');
  const contractRaw = fs.readFileSync(contractPath, 'utf-8');
  const ledger = JSON.parse(ledgerRaw);
  const contract = JSON.parse(contractRaw);
  ledger.frozen_modules = ledger.frozen_modules || {};

  const prefix = `builders/${moduleName}/`;
  const alreadyLocked = Object.keys(ledger.frozen_modules).some(k => k.startsWith(prefix));
  if (contract.status === 'FROZEN' || alreadyLocked) {
    fail(`[${moduleName}] 은(는) 이미 동결되어 있습니다. 재동결은 허용되지 않습니다. 수정이 필요하면 헌법에 정의된 동결 해제 절차를 따르십시오.`);
  }

  for (const raw of contract.dependencies?.internal_modules || []) {
    const depName = String(raw).replace(/^@\//, '').replace(/\/+$/, '').replace(/^builders\//, '');
    let depStatus = null;
    try {
      depStatus = JSON.parse(fs.readFileSync(path.join(BUILDERS_DIR, depName, 'contract.json'), 'utf-8')).status;
    } catch { /* 존재하지 않으면 null */ }
    if (depStatus !== 'FROZEN') {
      fail(`의존 모듈이 아직 동결되지 않았습니다: builders/${depName} (status: ${depStatus ?? '없음'}). 의존 모듈을 먼저 동결하십시오.`);
    }
  }

  const rollback = () => {
    fs.writeFileSync(LEDGER_PATH, ledgerRaw, 'utf-8');
    fs.writeFileSync(contractPath, contractRaw, 'utf-8');
  };

  try {
    for (const file of fs.readdirSync(modulePath)) {
      const absPath = path.join(modulePath, file);
      if (!fs.statSync(absPath).isFile() || file === 'contract.json') continue;
      const relPath = path.posix.join('builders', moduleName, file);
      const hash = getFileHash(absPath);
      ledger.frozen_modules[relPath] = hash;
      console.log(`🔒 [LOCKED] ${relPath} -> ${hash.substring(0, 8)}...`);
    }

    contract.status = 'FROZEN';
    contract.frozen_at = new Date().toISOString();
    fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf-8');
    const contractRelPath = path.posix.join('builders', moduleName, 'contract.json');
    ledger.frozen_modules[contractRelPath] = getFileHash(contractPath);
    console.log(`🔒 [LOCKED] ${contractRelPath} -> ${ledger.frozen_modules[contractRelPath].substring(0, 8)}...`);

    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf-8');
  } catch (e) {
    rollback();
    fail(`동결 중 예외 발생, 원상 복구함: ${e.message}`);
  }

  if (!runAudit('사후')) {
    rollback();
    fail('사후 감사 실패. 장부와 계약서를 동결 이전 상태로 복구했습니다.');
  }

  console.log('--------------------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', `✅ [${moduleName}] 모듈이 성공적으로 동결(FROZEN)되었습니다. 장부에 해시가 기록되었습니다.`);
}

freezeModule(process.argv[2]);
