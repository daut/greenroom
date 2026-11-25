import type { ReactNode } from "react";

/** Renders model text: blank-line paragraphs, "- " bullets and **bold**. No HTML is injected. */
export function RichText({ text }: { text: string }) {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    .flatMap(splitLists);
  return (
    <>
      {blocks.map((block, i) =>
        block.list ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text blocks
          <ul key={i} className="bullets">
            {block.lines.map((l, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static text lines
              <li key={j}>{inline(l.replace(BULLET, ""))}</li>
            ))}
          </ul>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text blocks
          <p key={i}>{inline(block.lines.join("\n"))}</p>
        ),
      )}
    </>
  );
}

const BULLET = /^\s*[-*•]\s+/;

/** A paragraph may run straight into a list ("Examples:\n- a\n- b"); split them apart. */
function splitLists(block: string): { list: boolean; lines: string[] }[] {
  const parts: { list: boolean; lines: string[] }[] = [];
  for (const line of block.split("\n")) {
    const list = BULLET.test(line);
    const last = parts.at(-1);
    if (last && last.list === list) last.lines.push(line);
    else parts.push({ list, lines: [line] });
  }
  return parts;
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
