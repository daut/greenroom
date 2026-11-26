import { describe, expect, it } from "vitest";
import {
  completePhase,
  contextOf,
  filterSessions,
  finishSession,
  isFinished,
  newSession,
  nextPhase,
  type Phase,
  phaseState,
  phasesOf,
  reopenSession,
  saveArtifact,
  type TrainingDefinition,
} from "./training";

const def: TrainingDefinition = {
  id: "t",
  title: "Test training",
  summary: "",
  phases: [
    { kind: "form", id: "setup", title: "Setup", fields: [] },
    { kind: "form", id: "a", title: "A", fields: [] },
    { kind: "form", id: "b", title: "B", fields: [], after: ["a"] },
    { kind: "form", id: "c", title: "C", fields: [], after: ["a"] },
  ],
};

const T0 = new Date("2026-11-25T10:00:00Z");
const T1 = new Date("2026-11-25T11:00:00Z");

describe("phaseState", () => {
  it("unlocks a phase once the previous one is done, by default", () => {
    const s = newSession(def, "id1", T0);

    expect(phaseState(def, s, "setup")).toBe("ready");
    expect(phaseState(def, s, "a")).toBe("locked");
    expect(phaseState(def, completePhase(def, s, "setup", {}, T1), "a")).toBe("ready");
  });

  it("honours explicit dependencies, so siblings unlock together", () => {
    let s = newSession(def, "id1", T0);
    s = completePhase(def, s, "setup", {}, T1);
    s = completePhase(def, s, "a", {}, T1);

    expect(phaseState(def, s, "b")).toBe("ready");
    expect(phaseState(def, s, "c")).toBe("ready");
    expect(phaseState(def, s, "a")).toBe("done");
  });
});

describe("completePhase", () => {
  it("stores the artifact, marks done and bumps updatedAt", () => {
    const s = completePhase(def, newSession(def, "id1", T0), "setup", { x: 1 }, T1);

    expect(s.artifacts.setup).toEqual({ x: 1 });
    expect(s.done).toEqual(["setup"]);
    expect(s.updatedAt).toBe(T1.toISOString());
    expect(s.createdAt).toBe(T0.toISOString());
  });

  it("redoing a phase reopens everything that depends on it, keeping their work", () => {
    let s = newSession(def, "id1", T0);
    for (const id of ["setup", "a", "b", "c"]) s = completePhase(def, s, id, { id }, T1);

    s = completePhase(def, s, "setup", { changed: true }, T1);

    expect(s.done).toEqual(["setup"]);
    expect(s.artifacts.b).toEqual({ id: "b" });
  });
});

describe("saveArtifact", () => {
  it("keeps work in progress without marking the phase done", () => {
    const s = saveArtifact(newSession(def, "id1", T0), "setup", { draft: true }, T1);

    expect(s.artifacts.setup).toEqual({ draft: true });
    expect(s.done).toEqual([]);
  });
});

describe("nextPhase", () => {
  it("points at the first ready phase that isn't done", () => {
    let s = newSession(def, "id1", T0);
    expect(nextPhase(def, s)?.id).toBe("setup");

    s = completePhase(def, s, "setup", {}, T1);
    s = completePhase(def, s, "a", {}, T1);
    expect(nextPhase(def, s)?.id).toBe("b");
  });

  it("returns null when everything is done", () => {
    let s = newSession(def, "id1", T0);
    for (const id of ["setup", "a", "b", "c"]) s = completePhase(def, s, id, {}, T1);

    expect(nextPhase(def, s)).toBeNull();
  });
});

describe("contextOf", () => {
  it("reads other phases' artifacts", () => {
    const s = completePhase(def, newSession(def, "id1", T0), "setup", { company: "Acme" }, T1);

    expect(contextOf(s).artifact<{ company: string }>("setup")?.company).toBe("Acme");
    expect(contextOf(s).artifact("missing")).toBeUndefined();
  });
});

describe("finishing a session", () => {
  it("is explicit, bumps updatedAt so sync picks it up, and can be undone", () => {
    const s = newSession(def, "id1", T0);
    expect(isFinished(s)).toBe(false);

    const finished = finishSession(s, T1);
    expect(isFinished(finished)).toBe(true);
    expect(finished.finishedAt).toBe(T1.toISOString());
    expect(finished.updatedAt).toBe(T1.toISOString());

    const reopened = reopenSession(finished, T1);
    expect(isFinished(reopened)).toBe(false);
    expect(reopened).not.toHaveProperty("finishedAt");
  });

  it("stays finished when a phase is redone", () => {
    const s = finishSession(newSession(def, "id1", T0), T0);

    expect(isFinished(completePhase(def, s, "setup", {}, T1))).toBe(true);
  });
});

describe("phases that depend on the setup", () => {
  const extra: Phase = { kind: "form", id: "extra", title: "Extra", fields: [] };
  const growing: TrainingDefinition = {
    ...def,
    phasesFor: (ctx) =>
      ctx.artifact<{ more?: string }>("setup")?.more ? [...def.phases, extra] : def.phases,
  };

  it("uses the static list until the setup asks for more", () => {
    const s = newSession(growing, "id1", T0);

    expect(phasesOf(growing, s).map((p) => p.id)).toEqual(["setup", "a", "b", "c"]);
    const more = saveArtifact(s, "setup", { more: "yes" }, T1);
    expect(phasesOf(growing, more).map((p) => p.id)).toEqual(["setup", "a", "b", "c", "extra"]);
  });

  it("unlocks and reopens the added phases like any other", () => {
    let s = completePhase(growing, newSession(growing, "id1", T0), "setup", { more: "yes" }, T1);
    for (const id of ["a", "b", "c"]) s = completePhase(growing, s, id, {}, T1);

    expect(phaseState(growing, s, "extra")).toBe("ready");
    expect(nextPhase(growing, s)?.id).toBe("extra");
    s = completePhase(growing, s, "extra", {}, T1);
    s = completePhase(growing, s, "c", {}, T1);
    expect(phaseState(growing, s, "extra")).toBe("ready");
  });
});

describe("filterSessions", () => {
  const interview = { ...newSession(def, "i", T0), trainingId: "interview" };
  const english = finishSession({ ...newSession(def, "e", T0), trainingId: "english" }, T1);
  const all = [interview, english];

  it("filters by training and status, keeping order", () => {
    expect(filterSessions(all, { training: "all", status: "all" })).toEqual(all);
    expect(filterSessions(all, { training: "english", status: "all" })).toEqual([english]);
    expect(filterSessions(all, { training: "all", status: "open" })).toEqual([interview]);
    expect(filterSessions(all, { training: "all", status: "finished" })).toEqual([english]);
    expect(filterSessions(all, { training: "interview", status: "finished" })).toEqual([]);
  });
});
