import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Write via temp file + rename so a crash never leaves a half-written file. */
export function writeFileAtomic(
  filePath: string,
  content: string,
  mode = 0o644,
  encoding: BufferEncoding = "utf8",
) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, content, { mode, encoding });
  renameSync(tmp, filePath);
}
