import { existsSync, readFileSync } from "node:fs";
import { writeFileAtomic } from "./fs-utils";

/** Voice spend in USD per calendar month ("2026-11": 3.42), used for the monthly budget. */
export function createSpendLedger(filePath: string) {
  function monthTotal(date = new Date()): number {
    return read()[monthKey(date)] ?? 0;
  }

  function record(usd: number, date = new Date()) {
    if (!Number.isFinite(usd) || usd <= 0) return;
    const data = read();
    const key = monthKey(date);
    data[key] = (data[key] ?? 0) + usd;
    writeFileAtomic(filePath, JSON.stringify(data, null, 2));
  }

  function read(): Record<string, number> {
    if (!existsSync(filePath)) return {};
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, number>;
    } catch {
      return {};
    }
  }

  return { monthTotal, record };
}

export type SpendLedger = ReturnType<typeof createSpendLedger>;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
