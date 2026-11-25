import { describe, expect, it } from "vitest";
import { planSync } from "./plan";

const l = (id: string, updatedAt: string) => ({ id, updatedAt });
const r = (id: string, updatedAt: string, deleted = false) => ({ id, updatedAt, deleted });

describe("planSync", () => {
  it("uploads local-only and downloads remote-only sessions", () => {
    expect(planSync([l("a", "1")], [r("b", "1")], [])).toEqual({
      upload: ["a"],
      download: ["b"],
      deleteLocal: [],
      deleteRemote: [],
    });
  });

  it("lets the newer copy win", () => {
    const plan = planSync(
      [l("a", "2026-11-02"), l("b", "2026-11-01")],
      [r("a", "2026-11-01"), r("b", "2026-11-02")],
      [],
    );

    expect(plan.upload).toEqual(["a"]);
    expect(plan.download).toEqual(["b"]);
  });

  it("does nothing when both copies are equal", () => {
    expect(planSync([l("a", "1")], [r("a", "1")], [])).toEqual({
      upload: [],
      download: [],
      deleteLocal: [],
      deleteRemote: [],
    });
  });

  it("propagates local deletions and never re-downloads them", () => {
    const plan = planSync([], [r("gone", "1")], ["gone"]);

    expect(plan.deleteRemote).toEqual(["gone"]);
    expect(plan.download).toEqual([]);
  });

  it("removes sessions deleted on another machine", () => {
    const plan = planSync([l("a", "1")], [r("a", "2", true)], []);

    expect(plan.deleteLocal).toEqual(["a"]);
    expect(plan.upload).toEqual([]);
  });

  it("ignores remote tombstones that don't exist locally", () => {
    expect(planSync([], [r("x", "1", true)], []).download).toEqual([]);
  });
});
