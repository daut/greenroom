import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createSpendLedger } from "./spend-ledger";

let file: string;

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), "greenroom-spend-")), "spend.json");
});

const nov = new Date("2026-11-24T12:00:00");
const dec = new Date("2026-12-01T09:00:00");

describe("spend ledger", () => {
  it("sums spend per calendar month and persists it", () => {
    createSpendLedger(file).record(1.25, nov);
    createSpendLedger(file).record(0.5, nov);
    createSpendLedger(file).record(2, dec);

    expect(createSpendLedger(file).monthTotal(nov)).toBeCloseTo(1.75);
    expect(createSpendLedger(file).monthTotal(dec)).toBeCloseTo(2);
  });

  it("ignores non-positive or non-finite amounts", () => {
    const ledger = createSpendLedger(file);
    ledger.record(-1, nov);
    ledger.record(Number.NaN, nov);

    expect(ledger.monthTotal(nov)).toBe(0);
  });

  it("starts fresh when the file is corrupt", () => {
    writeFileSync(file, "{nope");

    expect(createSpendLedger(file).monthTotal(nov)).toBe(0);
  });
});
