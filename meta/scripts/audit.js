import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { builtinModules } from 'node:module';

const ROOT_DIR = process.cwd();
const CONSTITUTION_PATH = path.join(ROOT_DIR, 'system', 'CONSTITUTION.md');
const LEDGER_PATH = path.join(ROOT_DIR, 'meta', 'ledger', 'registry-state.json');
const BUILDERS_DIR = path.join(ROOT_DIR, 'builders');

// [동기화 필수] meta/scripts/ratify.js 의 GOVERNANCE_FILES 와 반드시 동일해야 한다.
const GOVERNANCE_FILES = [
  'meta/scripts/audit.js',
  'meta/scripts/freeze.js',
  'meta/scripts/ratify.js',
  'meta/contracts/module-contract.template.json',
  'package.json'
];

const BUILTINS = new Set(builtinModules);

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
];

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function toPosixRel(absPath) {
  return path.relative(ROOT_DIR, absPath).split(path.sep).join('/');
}

function normalizeDep(dep) {
  return String(dep).replace(/^@\//, '').replace(/\/+$/, '');
}

function packageNameOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function extractSpecifiers(source) {
  const specs = new Set();
  for (const re of IMPORT_PATTERNS) {
    for (const m of source.matchAll(re)) specs.add(m[1]);
  }
  return [...specs];
}

function auditLedger(errors) {
  if (!fs.existsSync(CONSTITUTION_PATH)) {
    errors.push('CRITICAL: system/CONSTITUTION.md (헌법) 파일이 누락되었습니다.');
  }
  if (!fs.existsSync(LEDGER_PATH)) {
    errors.push('CRITICAL: meta/ledger/registry-state.json (동결 장부)가 누락되었습니다.');
    return;
  }

  let ledger;
  try {
    ledger = readJson(LEDGER_PATH);
  } catch (e) {
    errors.push(`PARSER ERROR: registry-state.json 파싱 실패: ${e.message}`);
    return;
  }

  const constitutionHash = getFileHash(CONSTITUTION_PATH);
  if (constitutionHash) {
    if (!ledger.system_constitution_hash) {
      errors.push('UNRATIFIED: 장부에 헌법 해시가 없습니다. 감독관 승인 후 npm run ratify 를 실행하십시오.');
    } else if (ledger.system_constitution_hash !== constitutionHash) {
      errors.push('CONSTITUTION TAMPERED: system/CONSTITUTION.md 가 비준된 버전과 다릅니다. 정식 개정이라면 감독관 승인 후 npm run ratify 를 실행하십시오.');
    }
  }

  const gov = ledger.governance_files;
  if (!gov || typeof gov !== 'object') {
    errors.push('UNRATIFIED: 장부에 governance_files 가 없습니다. 감독관 승인 후 npm run ratify -- --approved-by <이름> 을 실행하십시오.');
  } else {
    for (const rel of GOVERNANCE_FILES) {
      const currentHash = getFileHash(path.join(ROOT_DIR, rel));
      if (!currentHash) {
        errors.push(`GOVERNANCE MISSING: 거버넌스 파일이 삭제됨: ${rel}`);
      } else if (!gov[rel]) {
        errors.push(`UNRATIFIED: 비준 목록에 없는 거버넌스 파일: ${rel}`);
      } else if (gov[rel] !== currentHash) {
        errors.push(`GOVERNANCE TAMPERED: 비준 이후 변경됨: ${rel}`);
      }
    }
    for (const rel of Object.keys(gov)) {
      if (!GOVERNANCE_FILES.includes(rel)) {
        errors.push(`LEDGER INVALID: 알 수 없는 거버넌스 항목: ${rel}`);
      }
    }
  }

  if (ledger.frozen_modules) {
    for (const [filePath, expectedHash] of Object.entries(ledger.frozen_modules)) {
      const currentHash = getFileHash(path.join(ROOT_DIR, filePath));
      if (!currentHash) {
        errors.push(`INTEGRITY ERROR: 동결된 파일이 삭제됨: ${filePath}`);
      } else if (currentHash !== expectedHash) {
        errors.push(`INTEGRITY ERROR: 동결된 파일이 무단 변조됨: ${filePath}`);
      }
    }
  }
}

function loadContracts(errors) {
  const contracts = new Map();
  if (!fs.existsSync(BUILDERS_DIR)) return contracts;

  const folders = fs.readdirSync(BUILDERS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const folderName of folders) {
    const contractPath = path.join(BUILDERS_DIR, folderName, 'contract.json');
    if (!fs.existsSync(contractPath)) {
      errors.push(`CONTRACT MISSING: [${folderName}] 모듈에 contract.json 계약서가 없습니다.`);
      contracts.set(folderName, null);
      continue;
    }
    try {
      contracts.set(folderName, readJson(contractPath));
    } catch (e) {
      errors.push(`PARSER ERROR: [${folderName}] contract.json 파싱 실패: ${e.message}`);
      contracts.set(folderName, null);
    }
  }
  return contracts;
}

function auditContractShape(folderName, contract, errors) {
  const requiredFields = ['module_name', 'status', 'scope', 'interfaces', 'dependencies'];
  for (const field of requiredFields) {
    if (!contract[field]) {
      errors.push(`CONTRACT INVALID: [${folderName}] contract.json에 필수 필드 누락 -> '${field}'`);
    }
  }

  if (contract.scope && Array.isArray(contract.scope.target_files)) {
    const declaredFiles = new Set(contract.scope.target_files.map(f => path.normalize(f)));
    declaredFiles.add(path.normalize(`builders/${folderName}/contract.json`));

    const actualFiles = fs.readdirSync(path.join(BUILDERS_DIR, folderName))
      .map(f => path.normalize(`builders/${folderName}/${f}`));

    for (const file of actualFiles) {
      if (!declaredFiles.has(file)) {
        errors.push(`SCOPE LEAK: [${folderName}] 선언되지 않은 미확인 파일 발견 -> ${file}`);
      }
    }
  }
}

function auditDependencies(folderName, contract, contracts, errors) {
  const declaredModules = new Set();
  const deps = Array.isArray(contract.dependencies?.internal_modules)
    ? contract.dependencies.internal_modules
    : [];

  for (const raw of deps) {
    const dep = normalizeDep(raw);
    const m = dep.match(/^builders\/([^/]+)$/);
    if (!m) {
      errors.push(`DEPENDENCY INVALID: [${folderName}] 의존성 경로 형식 오류 -> '${raw}' (형식: builders/<모듈명>)`);
      continue;
    }
    const depName = m[1];
    if (depName === folderName) {
      errors.push(`DEPENDENCY INVALID: [${folderName}] 자기 자신을 의존성으로 선언함`);
      continue;
    }
    if (!contracts.has(depName)) {
      errors.push(`DEPENDENCY NOT FOUND: [${folderName}] 존재하지 않는 모듈 참조 -> ${dep}`);
      continue;
    }
    const depContract = contracts.get(depName);
    if (!depContract) {
      errors.push(`DEPENDENCY UNCONTRACTED: [${folderName}] 계약서가 없거나 손상된 모듈 참조 -> ${dep}`);
      continue;
    }
    declaredModules.add(depName);

    if (contract.status === 'FROZEN' && depContract.status !== 'FROZEN') {
      errors.push(`FREEZE ORDER VIOLATION: [${folderName}] FROZEN 모듈이 비동결 모듈에 의존 -> ${dep} (status: ${depContract.status})`);
    }
  }
  return declaredModules;
}

function auditImports(folderName, contract, declaredModules, errors) {
  const allowedPkgs = new Set(contract.dependencies?.allowed_external_pkgs || []);
  const moduleDir = path.join(BUILDERS_DIR, folderName);

  const jsFiles = fs.readdirSync(moduleDir, { withFileTypes: true })
    .filter(d => d.isFile() && /\.m?js$/.test(d.name))
    .map(d => d.name);

  for (const file of jsFiles) {
    const fileAbs = path.join(moduleDir, file);
    const fileRel = toPosixRel(fileAbs);
    const source = fs.readFileSync(fileAbs, 'utf-8');

    for (const spec of extractSpecifiers(source)) {
      if (spec.startsWith('node:') || BUILTINS.has(spec)) continue;

      let targetAbs;
      if (spec.startsWith('./') || spec.startsWith('../')) {
        targetAbs = path.resolve(path.dirname(fileAbs), spec);
      } else if (spec.startsWith('@/')) {
        targetAbs = path.resolve(ROOT_DIR, spec.slice(2));
      } else if (spec.startsWith('/')) {
        errors.push(`ABSOLUTE IMPORT: [${folderName}] ${fileRel} -> '${spec}' (절대 경로 참조 금지)`);
        continue;
      } else {
        const pkg = packageNameOf(spec);
        if (!allowedPkgs.has(pkg)) {
          errors.push(`UNDECLARED PACKAGE: [${folderName}] ${fileRel} -> '${spec}' (allowed_external_pkgs 미선언)`);
        }
        continue;
      }

      const targetRel = toPosixRel(targetAbs);
      if (!fs.existsSync(targetAbs)) {
        errors.push(`BROKEN IMPORT: [${folderName}] ${fileRel} -> '${spec}' (존재하지 않는 경로: ${targetRel})`);
        continue;
      }

      const m = targetRel.match(/^builders\/([^/]+)(\/|$)/);
      if (!m) {
        errors.push(`OUT-OF-BOUNDS IMPORT: [${folderName}] ${fileRel} -> '${spec}' (builders/ 외부 참조 금지: ${targetRel})`);
        continue;
      }

      const targetModule = m[1];
      if (targetModule === folderName) continue;
      if (!declaredModules.has(targetModule)) {
        errors.push(`UNDECLARED DEPENDENCY: [${folderName}] ${fileRel} -> builders/${targetModule} (contract.json internal_modules 미선언)`);
      }
    }
  }
}

function auditModules(errors) {
  const contracts = loadContracts(errors);
  for (const [folderName, contract] of contracts) {
    if (!contract) continue;
    auditContractShape(folderName, contract, errors);
    const declaredModules = auditDependencies(folderName, contract, contracts, errors);
    auditImports(folderName, contract, declaredModules, errors);
  }
}

function runAudit() {
  console.log('\x1b[36m%s\x1b[0m', '>>> [meta-narrative-forge] 정적 무결성 감사 시작...');
  const errors = [];

  auditLedger(errors);
  auditModules(errors);

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
