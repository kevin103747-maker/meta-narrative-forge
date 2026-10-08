const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_MAX_CHARS = 300;
const MIN_MAX_CHARS = 10;
const ELLIPSIS = '…';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function codePointLength(s) {
  return [...s].length;
}

export class ContextAssembler {
  // provider 규격 검증 (등록 시점, 헌법 제3조: 동기 순수 함수만 허용)
  static createProvider(name, fn, options = {}) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
      throw new TypeError(`[ContextAssembler] provider 이름 형식 오류: '${name}' (소문자 kebab-case 만 허용)`);
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`[ContextAssembler] provider '${name}' 는 함수여야 합니다.`);
    }
    const ctorName = fn.constructor?.name;
    if (ctorName === 'AsyncFunction' || ctorName === 'AsyncGeneratorFunction' || ctorName === 'GeneratorFunction') {
      throw new TypeError(`[ContextAssembler] provider '${name}' 는 동기 순수 함수여야 합니다 (async/generator 금지, 헌법 제3조).`);
    }
    if (!isPlainObject(options)) {
      throw new TypeError(`[ContextAssembler] provider '${name}' options 는 객체여야 합니다.`);
    }
    const maxChars = options.maxChars === undefined ? DEFAULT_MAX_CHARS : options.maxChars;
    if (!Number.isInteger(maxChars) || maxChars < MIN_MAX_CHARS) {
      throw new RangeError(`[ContextAssembler] provider '${name}' maxChars 는 ${MIN_MAX_CHARS} 이상의 정수여야 합니다: ${maxChars}`);
    }
    return Object.freeze({ name, fn, maxChars });
  }

  // 줄 단위 예산 절단. 첫 줄부터 초과하면 코드포인트 기준으로 자르고 '…' 부착
  static applyBudget(lines, maxChars) {
    const kept = [];
    let usedChars = 0;
    let mode = 'none';
    for (const line of lines) {
      const len = codePointLength(line);
      const cost = kept.length === 0 ? len : len + 1;
      if (usedChars + cost <= maxChars) {
        kept.push(line);
        usedChars += cost;
        continue;
      }
      if (kept.length === 0) {
        kept.push([...line].slice(0, maxChars - 1).join('') + ELLIPSIS);
        usedChars = maxChars;
        mode = 'hard';
      } else {
        mode = 'lines';
      }
      break;
    }
    return {
      kept,
      report: { maxChars, usedChars, totalLines: lines.length, keptLines: kept.length, mode }
    };
  }

  static validateResult(name, result) {
    const tag = `[ContextAssembler] provider '${name}' 반환 형식 오류`;
    if (result && typeof result.then === 'function') {
      throw new TypeError(`${tag}: Promise 반환 금지 (동기 함수만 허용)`);
    }
    if (!isPlainObject(result)) {
      throw new TypeError(`${tag}: { lines: string[], data?: object } 객체여야 합니다.`);
    }
    if (!Array.isArray(result.lines)) {
      throw new TypeError(`${tag}: lines 는 배열이어야 합니다.`);
    }
    result.lines.forEach((line, i) => {
      if (typeof line !== 'string') throw new TypeError(`${tag}: lines[${i}] 는 문자열이어야 합니다.`);
      if (/[\r\n]/.test(line)) throw new TypeError(`${tag}: lines[${i}] 에 줄바꿈 문자를 넣을 수 없습니다.`);
    });
    if (result.data !== undefined && !isPlainObject(result.data)) {
      throw new TypeError(`${tag}: data 는 객체여야 합니다.`);
    }
    let data;
    try {
      data = structuredClone(result.data ?? {});
    } catch (e) {
      throw new TypeError(`${tag}: data 는 복제 가능한 순수 데이터여야 합니다 (${e.message})`);
    }
    return { lines: [...result.lines], data };
  }

  // provider 입력: 깊은 동결 사본 (변조 시도 시 strict mode TypeError)
  static buildProviderInput({ characters, worldGraph, involvedCharacterIds, locationId, currentSceneIndex }) {
    const chars = involvedCharacterIds.map(id => characters.get(id)).filter(Boolean);
    const location = worldGraph ? worldGraph.getLocation(locationId) : null;
    return deepFreeze(structuredClone({
      currentSceneIndex,
      locationId: locationId ?? null,
      location: location ?? null,
      involvedCharacterIds: [...involvedCharacterIds],
      characters: chars
    }));
  }

  static runProviders(providers, input) {
    const extensions = {};
    const budget = {};
    for (const p of providers) {
      let result;
      try {
        result = p.fn(input);
      } catch (e) {
        const Ctor = e instanceof TypeError ? TypeError : Error;
        throw new Ctor(`[ContextAssembler] provider '${p.name}' 실행 실패: ${e.message}`, { cause: e });
      }
      const { lines, data } = ContextAssembler.validateResult(p.name, result);
      const { kept, report } = ContextAssembler.applyBudget(lines, p.maxChars);
      extensions[p.name] = { lines: kept, data };
      budget[p.name] = report;
    }
    extensions._budget = budget;
    return extensions;
  }

  static assemble({ characters, worldGraph, logicCompiler, involvedCharacterIds = [], locationId, currentSceneIndex = 1, providers = [] }) {
    const sceneCharacters = involvedCharacterIds.map(id => {
      const char = characters.get(id);
      if (!char) return null;
      return {
        id: char.id,
        name: char.name,
        role: char.role,
        physical: {
          hp: char.physical?.hp,
          hunger: char.physical?.hunger,
          injuries: char.physical?.injuries || [],
          inventory: char.physical?.inventory || []
        },
        psychological: {
          dominant_emotion: char.psychological?.dominant_emotion,
          stress: char.psychological?.stress,
          current_goal: char.psychological?.current_goal
        }
      };
    }).filter(Boolean);

    const location = worldGraph ? worldGraph.getLocation(locationId) : null;
    const sceneLocation = location ? {
      id: location.id,
      name: location.name,
      zone_type: location.zone_type,
      attributes: location.attributes || []
    } : { id: locationId, name: '미확인 장소' };

    let activeForeshadows = [];
    if (logicCompiler) {
      const readiness = logicCompiler.evaluateSceneReadiness({ currentLocation: locationId });
      activeForeshadows = readiness.urgentForeshadows;
    }

    const baseInstruction = [
      `[SCENE CONTEXT #${currentSceneIndex}]`,
      `Location: ${sceneLocation.name} (${sceneLocation.zone_type})`,
      `Attributes: ${(sceneLocation.attributes || []).join(', ') || 'none'}`,
      `Characters: ${sceneCharacters.map(c => `${c.name}(${c.psychological.dominant_emotion})`).join(', ')}`,
      activeForeshadows.length > 0
        ? `Objective (Foreshadow): ${activeForeshadows.map(f => `"${f.title}"`).join(', ')}`
        : 'Objective: 자연스러운 전개 및 인물 상태 묘사'
    ].join('\n');

    // provider 0개면 extensions = {} 이고 systemInstruction 은 v0.1.0 과 바이트 동일
    const extensions = providers.length === 0
      ? {}
      : ContextAssembler.runProviders(providers, ContextAssembler.buildProviderInput({
          characters, worldGraph, involvedCharacterIds, locationId, currentSceneIndex
        }));

    const extBlocks = providers
      .filter(p => extensions[p.name].lines.length > 0)
      .map(p => [`[EXT:${p.name}]`, ...extensions[p.name].lines].join('\n'));

    const systemInstruction = extBlocks.length > 0
      ? [baseInstruction, ...extBlocks].join('\n')
      : baseInstruction;

    return {
      systemInstruction,
      sceneLocation,
      sceneCharacters,
      activeForeshadows,
      extensions
    };
  }
}
