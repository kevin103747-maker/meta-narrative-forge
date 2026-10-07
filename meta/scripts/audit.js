import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();
const CONSTITUTION_PATH = path.join(ROOT_DIR, 'system', 'CONSTITUTION.md');
const LEDGER_PATH = path.join(ROOT_DIR, 'meta', 'ledger', 'registry-state.json');
const BUILDERS_DIR = path.join(ROOT_DIR, 'builders');

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function runAudit() {
  console.log('\x1b[36m%s\x1b[0m', '>>> [meta-narrative-forge] 정적 무결성 감사 시작...');
  const errors = [];

  if (!fs.existsSync(CONSTITUTION_PATH)) {
    errors.push('CRITICAL: system/CONSTITUTION.md (헌법) 파일이 누락되었습니다.');
  }

  if (!fs.existsSync(LEDGER_PATH)) {
    errors.push('CRITICAL: meta/ledger/registry-state.json (동결 장부)가 누락되었습니다.');
  } else {
    try {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
      if (ledger.frozen_modules) {
        for (const [filePath, expectedHash] of Object.entries(ledger.frozen_modules)) {
          const actualPath = path.join(ROOT_DIR, filePath);
          const currentHash = getFileHash(actualPath);
          if (!currentHash) {
            errors.push(`INTEGRITY ERROR: 동결된 파일이 삭제됨: ${filePath}`);
          } else if (currentHash !== expectedHash) {
            errors.push(`INTEGRITY ERROR: 동결된 파일이 무단 변조됨: ${filePath}`);
          }
        }
      }
    } catch (e) {
      errors.push(`PARSER ERROR: registry-state.json 파싱 실패: ${e.message}`);
    }
  }

  if (fs.existsSync(BUILDERS_DIR)) {
    const builderFolders = fs.readdirSync(BUILDERS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const folderName of builderFolders) {
      const modulePath = path.join(BUILDERS_DIR, folderName);
      const contractPath = path.join(modulePath, 'contract.json');

      if (!fs.existsSync(contractPath)) {
        errors.push(`CONTRACT MISSING: [${folderName}] 모듈에 contract.json 계약서가 없습니다.`);
        continue;
      }

      try {
        const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
        const requiredFields = ['module_name', 'status', 'scope', 'interfaces', 'dependencies'];
        for (const field of requiredFields) {
          if (!contract[field]) {
            errors.push(`CONTRACT INVALID: [${folderName}] contract.json에 필수 필드 누락 -> '${field}'`);
          }
        }

        if (contract.scope && Array.isArray(contract.scope.target_files)) {
          const declaredFiles = new Set(
            contract.scope.target_files.map(f => path.normalize(f))
          );
          declaredFiles.add(path.normalize(`builders/${folderName}/contract.json`));

          const actualFiles = fs.readdirSync(modulePath)
            .map(f => path.normalize(`builders/${folderName}/${f}`));

          for (const file of actualFiles) {
            if (!declaredFiles.has(file)) {
              errors.push(`SCOPE LEAK: [${folderName}] 선언되지 않은 미확인 파일 발견 -> ${file}`);
            }
          }
        }
      } catch (e) {
        errors.push(`PARSER ERROR: [${folderName}] contract.json 파싱 실패: ${e.message}`);
      }
    }
  }

  console.log('--------------------------------------------------');
  if (errors.length > 0) {
    console.error('\x1b[31m%s\x1b[0m', '❌ AUDIT FAILED - 다음 오류들을 해결하십시오:');
    errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    process.exit(1);
  } else {
    console.log('\x1b[32m%s\x1b[0m', '✅ ALL CHECKS PASSED: 모든 모듈과 계약이 헌법에 부합합니다.');
    process.exit(0);
  }
}

runAudit();
