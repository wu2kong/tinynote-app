/** Strip // and block comments so JSON.parse can read JSONC. */
export function stripJsoncComments(input: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringQuote = '"';
  let escaped = false;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      result += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length - 1 && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    result += ch;
    i += 1;
  }

  return result;
}

export function parseJsonc<T = unknown>(input: string): T {
  return JSON.parse(stripJsoncComments(input)) as T;
}

export function stringifyJsonc(data: unknown): string {
  const header = [
    '// TinyNote 工作区配置 — 可纳入 Git 同步',
    '// 路径字段为相对笔记库根目录；backupDir / syncAuthToken / llmProviders 保存在本机 work-spaces.json',
    '',
  ].join('\n');
  return `${header}${JSON.stringify(data, null, 2)}\n`;
}
