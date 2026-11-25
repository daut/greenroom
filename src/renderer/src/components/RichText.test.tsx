// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RichText } from "./RichText";

afterEach(cleanup);

describe("RichText", () => {
  it("splits a lead-in line from the list that follows it", () => {
    const { container } = render(<RichText text={"Fresh examples:\n- one\n- two\n\nDone."} />);

    expect([...container.children].map((e) => e.tagName)).toEqual(["P", "UL", "P"]);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });
});
