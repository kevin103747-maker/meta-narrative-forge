import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();
const LEDGER_PATH = path.join(ROOT_DIR, 'meta', 'ledger', 'registry-state.json');
const CONSTITUTION_PATH = path.join(ROOT_DIR, 'system', 'CONSTITUTION.md');
const BUILDERS_DIR = path.join(ROOT_DIR, 'builders');

function getFileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function freezeModule(moduleName) {
  if (!moduleName) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 에러: 동결할 모듈 이름을 지정하십시오. 예: npm run freeze schema-factory');
    process.exit(1);
  }

  const modulePath = path.join(BUILDERS_DIR, moduleName);
  const contractPath = path.join(modulePath, 'contract.json');

  if (!fs.existsSync(modulePath)) {
    console.error('\x1b[31m%s\x1b[0m', `❌ 에러: 모듈 디렉터리를 찾을 수 없습니다: builders/${moduleName}`);
    process.exit(1);
  }

  if (!fs.existsSync(contractPath)) {
    console.error('\x1b[31m%s\x1b[0m', `❌ 에러: contract.json 계약서가 없습니다: builders/${moduleName}/contract.json`);
    process.exit(1);
  }

  // 1. 장부 로드
  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
  ledger.frozen_modules = ledger.frozen_modules || {};

  // 2. 헌법 해시 최신화
  if (fs.existsSync(CONSTITUTION_PATH)) {
    ledger.system_constitution_hash = getFileHash(CONSTITUTION_PATH);
  }

  // 3. 모듈 파일 순회 및 해시 등록
  const files = fs.readdirSync(modulePath);
  for (const file of files) {
    const relPath = path.posix.join('builders', moduleName, file);
    const absPath = path.join(modulePath, file);

    if (fs.statSync(absPath).isFile()) {
      const hash = getFileHash(absPath);
      ledger.frozen_modules[relPath] = hash;
      console.log(`🔒 [LOCKED] ${relPath} -> ${hash.substring(0, 8)}...`);
    }
  }

  // 4. contract.json 상태를 FROZEN으로 변경
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
  contract.status = 'FROZEN';
  contract.frozen_at = new Date().toISOString();
  fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf-8');

  // 계약서 자체의 해시도 갱신된 내용으로 다시 기록
  const contractRelPath = path.posix.join('builders', moduleName, 'contract.json');
  ledger.frozen_modules[contractRelPath] = getFileHash(contractPath);

  // 5. 장부 영구 저장
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf-8');

  console.log('--------------------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', `✅ [${moduleName}] 모듈이 성공적으로 동결(FROZEN)되었습니다. 장부에 해시가 기록되었습니다.`);
}

const targetModule = process.argv[2];
freezeModule(targetModule);
