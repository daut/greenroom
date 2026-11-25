import type { ReactNode } from "react";

/** Renders model text: blank-line paragraphs, "- " bullets and **bold**. No HTML is injected. */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static text blocks
            <ul key={i} className="bullets">
              {lines.map((l, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static text lines
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        // biome-ignore lint/suspicious/noArrayIndexKey: static text blocks
        return <p key={i}>{inline(block)}</p>;
      })}
    </>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static text parts
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}
