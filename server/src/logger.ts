import fs from 'node:fs';
import path from 'node:path';

// Лог сервера — пишется в папку, из которой запущен сервер (process.cwd()).
const LOG_FILE = path.join(process.cwd(), 'geoman-server.log');

function writeLine(line: string): void {
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {
    /* запись лога не должна ронять сервер */
  }
}

export function logFilePath(): string {
  return LOG_FILE;
}

export function logInfo(message: string): void {
  writeLine(`[${new Date().toISOString()}] INFO ${message}`);
}

export function logError(err: Error & { status?: number }, reqInfo?: { method: string; url: string }): void {
  const ts = new Date().toISOString();
  const status = err.status ?? 500;
  const where = reqInfo ? `${reqInfo.method} ${reqInfo.url}` : '';
  const lines = [
    `[${ts}] ERROR ${status}${where ? ' ' + where : ''}`,
    `  name: ${err.name || 'Error'}`,
    `  message: ${err.message || '(нет сообщения)'}`,
  ];
  if (err.stack) {
    lines.push('  stack:');
    for (const line of err.stack.split('\n')) lines.push(`    ${line}`);
  }
  lines.push('');
  writeLine(lines.join('\n'));
}
