// @vitest-environment jsdom
import type { Choice, PhaseContext, VoicePhase } from "@shared/training";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChoicePicker } from "./ChoicePicker";

const phase = {
  kind: "voice",
  id: "conversation",
  title: "Conversation",
  session: "drill",
  choices: () => [{ id: "work", label: "Your work" }],
  customChoice: { label: "Your own topic", placeholder: "Anything" },
  randomChoice: {
    label: "Surprise me",
    system: "",
    prompt: (_ctx: PhaseContext, past: string[]) => `avoid ${past.join(",")}`,
  },
  task: () => "",
} satisfies VoicePhase;
const ctx: PhaseContext = { artifact: () => undefined } as unknown as PhaseContext;

let complete: ReturnType<typeof vi.fn>;
beforeEach(() => {
  complete = vi.fn(async () => ({ topic: "Your favourite bridge" }));
  vi.stubGlobal("greenroom", { text: { complete } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPicker() {
  const onChange = vi.fn<(c: Choice | null) => void>();
  render(
    <ChoicePicker
      phase={phase}
      ctx={ctx}
      pastLabels={["Old topic"]}
      disabled={false}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("ChoicePicker", () => {
  it("starts on the first listed choice", () => {
    expect(renderPicker()).toHaveBeenLastCalledWith({ id: "work", label: "Your work" });
  });

  it("uses the typed topic, and nothing while it's empty", () => {
    const onChange = renderPicker();

    fireEvent.click(screen.getByLabelText("Your own topic"));
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.change(screen.getByPlaceholderText("Anything"), { target: { value: " Cats " } });
    expect(onChange).toHaveBeenLastCalledWith({ id: "custom", label: "Cats" });
  });

  it("generates a topic that avoids earlier ones, and rerolls on request", async () => {
    const onChange = renderPicker();

    fireEvent.click(screen.getByLabelText("Surprise me"));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ id: "random", label: "Your favourite bridge" }),
    );
    expect(complete.mock.calls[0]?.[0].prompt).toContain("Old topic");

    complete.mockResolvedValueOnce({ topic: "A second idea" });
    fireEvent.click(screen.getByRole("button", { name: "Another one" }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ id: "random", label: "A second idea" }),
    );
    expect(complete.mock.calls[1]?.[0].prompt).toContain("Your favourite bridge");
  });

  it("shows why generating failed", async () => {
    complete.mockRejectedValueOnce(new Error("No provider"));
    renderPicker();

    fireEvent.click(screen.getByLabelText("Surprise me"));

    expect((await screen.findByRole("alert")).textContent).toContain("No provider");
  });
});
