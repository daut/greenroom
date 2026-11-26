import { describe, expect, it } from "vitest";
import { roman } from "./text";

describe("roman", () => {
  it("numbers acts past twelve, as an interview loop has", () => {
    expect([1, 4, 9, 12, 13, 14, 17, 19, 40].map(roman)).toEqual([
      "I",
      "IV",
      "IX",
      "XII",
      "XIII",
      "XIV",
      "XVII",
      "XIX",
      "XL",
    ]);
  });
});
