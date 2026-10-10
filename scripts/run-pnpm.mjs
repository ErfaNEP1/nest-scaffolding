import { execFileSync } from 'node:child_process';

/**
 * Runs pnpm from a script. Uses the pnpm that started the script (npm_execpath) because on
 * Windows `pnpm` is a .cmd shim that execFileSync cannot start without a shell.
 */
export function runPnpm(args, options) {
  const execPath = process.env.npm_execpath;
  if (!execPath) return execFileSync('pnpm', args, options);
  if (/\.[cm]?js$/.test(execPath))
    return execFileSync(process.execPath, [execPath, ...args], options);
  return execFileSync(execPath, args, options);
}
