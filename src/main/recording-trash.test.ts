import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecordingTrash } from "./recording-trash";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "greenroom-recordings-"));
});

describe("recording trash", () => {
  it("deletes recordings and remembers their names for sync", () => {
    const take = join(dir, "take.webm");
    const mic = join(dir, "take.mic.webm");
    writeFileSync(take, "A");
    writeFileSync(mic, "M");

    createRecordingTrash(dir).remove([take, mic]);

    expect(existsSync(take)).toBe(false);
    expect(existsSync(mic)).toBe(false);
    expect(createRecordingTrash(dir).pending()).toEqual(["take.webm", "take.mic.webm"]);
  });

  it("remembers recordings that are only on the server", () => {
    const trash = createRecordingTrash(dir);
    trash.remove([join(dir, "elsewhere.webm")]);

    expect(trash.pending()).toEqual(["elsewhere.webm"]);
  });

  it("ignores paths outside the recordings folder", () => {
    const outside = join(mkdtempSync(join(tmpdir(), "greenroom-other-")), "keep.webm");
    writeFileSync(outside, "K");
    const trash = createRecordingTrash(dir);

    trash.remove([outside, join(dir, "..", "escape.webm")]);

    expect(existsSync(outside)).toBe(true);
    expect(trash.pending()).toEqual([]);
  });

  it("clears names once sync has deleted them", () => {
    const trash = createRecordingTrash(dir);
    trash.remove([join(dir, "a.webm"), join(dir, "b.webm")]);

    trash.clear(["a.webm"]);

    expect(trash.pending()).toEqual(["b.webm"]);
  });
});
