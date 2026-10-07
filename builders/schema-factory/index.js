import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemas = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'schemas.json'), 'utf-8')
);

function validateField(val, rule, fieldPath, errors) {
  if (val === undefined || val === null) return;

  const actualType = Array.isArray(val) ? 'array' : typeof val;
  if (rule.type && actualType !== rule.type) {
    errors.push(`[${fieldPath}] 타입 오류: 기대값 ${rule.type}, 실제값 ${actualType}`);
    return;
  }

  if (rule.enum && !rule.enum.includes(val)) {
    errors.push(`[${fieldPath}] 허용되지 않은 값: '${val}' (허용 목록: ${rule.enum.join(', ')})`);
  }

  if (rule.type === 'number') {
    if (rule.min !== undefined && val < rule.min) {
      errors.push(`[${fieldPath}] 범위 미달: 최소값 ${rule.min}, 실제값 ${val}`);
    }
    if (rule.max !== undefined && val > rule.max) {
      errors.push(`[${fieldPath}] 범위 초과: 최대값 ${rule.max}, 실제값 ${val}`);
    }
  }

  if (rule.type === 'object' && rule.required) {
    for (const reqKey of rule.required) {
      if (val[reqKey] === undefined) {
        errors.push(`[${fieldPath}.${reqKey}] 필수 필드 누락`);
      }
    }
  }

  if (rule.type === 'object' && rule.properties) {
    for (const [propKey, propRule] of Object.entries(rule.properties)) {
      if (val[propKey] !== undefined) {
        validateField(val[propKey], propRule, `${fieldPath}.${propKey}`, errors);
      }
    }
  }

  if (rule.type === 'array' && rule.items && Array.isArray(val)) {
    val.forEach((item, idx) => {
      validateField(item, rule.items, `${fieldPath}[${idx}]`, errors);
    });
  }
}

export function validate(type, data) {
  const schema = schemas[type];
  if (!schema) {
    return {
      valid: false,
      errors: [`알 수 없는 스키마 타입: '${type}'`]
    };
  }

  const errors = [];

  for (const req of schema.required) {
    if (data[req] === undefined || data[req] === null) {
      errors.push(`필수 필드 누락: '${req}'`);
    }
  }

  for (const [field, rule] of Object.entries(schema.properties)) {
    if (data[field] !== undefined) {
      validateField(data[field], rule, field, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export { schemas };
