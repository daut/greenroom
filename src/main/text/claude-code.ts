import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { ClaudeCodeStatus } from "@shared/text";

/**
 * Runs the user's own installed `claude` CLI (Claude Code) in print mode.
 * Personal, opt-in setup: it uses the user's login and plan limits. Nothing is bundled.
 */

export type Run = (
  file: string,
  args: string[],
  options: { timeoutMs: number },
) => Promise<{ stdout: string; code: number }>;

interface Request {
  binary: string;
  model: string;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
}

export async function completeWithClaudeCode(
  { binary, model, system, prompt, schema }: Request,
  run: Run = runFile,
): Promise<unknown> {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--model",
    model,
    "--system-prompt",
    system,
    "--tools",
    "",
    "--max-turns",
    "3",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--disable-slash-commands",
    ...(schema ? ["--json-schema", JSON.stringify(schema)] : []),
  ];
  const { stdout } = await run(binary, args, { timeoutMs: 180_000 });
  const result = parseResult(stdout);
  if (result.is_error) throw new Error(`Claude Code: ${result.result || "the run failed"}`);
  return schema ? result.structured_output : result.result;
}

export async function claudeCodeStatus(
  env: NodeJS.ProcessEnv = process.env,
  run: Run = runFile,
): Promise<ClaudeCodeStatus> {
  const path = findClaudeBinary(env);
  if (!path) return { installed: false, loggedIn: false, version: null, path: null };
  const version = await run(path, ["--version"], { timeoutMs: 10_000 })
    .then((r) => r.stdout.trim().split(" ")[0] ?? null)
    .catch(() => null);
  const loggedIn = await run(path, ["auth", "status"], { timeoutMs: 10_000 })
    .then((r) => (JSON.parse(r.stdout) as { loggedIn?: boolean }).loggedIn === true)
    .catch(() => false);
  return { installed: true, loggedIn, version, path };
}

/** GUI apps get a minimal PATH, so also look where the official installers put `claude`. */
export function findClaudeBinary(
  env: { PATH?: string; HOME?: string },
  exists: (path: string) => boolean = existsSync,
): string | null {
  const home = env.HOME ?? "";
  const dirs = [
    ...(env.PATH ?? "").split(delimiter).filter(Boolean),
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  return dirs.map((d) => join(d, "claude")).find((p) => exists(p)) ?? null;
}

interface ResultMessage {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
}

function parseResult(stdout: string): ResultMessage {
  try {
    return JSON.parse(stdout) as ResultMessage;
  } catch {
    throw new Error(`Claude Code returned unexpected output: ${stdout.slice(0, 200)}`);
  }
}

const runFile: Run = (file, args, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, cwd: tmpdir() },
      (error, stdout) => {
        // A failed run still prints a JSON result with is_error; prefer it over the exit code.
        if (stdout) return resolve({ stdout, code: error ? 1 : 0 });
        if (error) return reject(new Error(`Could not run Claude Code: ${error.message}`));
        resolve({ stdout, code: 0 });
      },
    );
  });
