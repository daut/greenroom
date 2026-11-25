/** What the hidden import window reads off a loaded page. */
export interface PageSnapshot {
  url: string;
  title: string;
  /** Raw contents of every `<script type="application/ld+json">`. */
  jsonLd: string[];
  /** Visible text of the main content, chrome (nav, header, footer) removed. */
  text: string;
}

const MIN_TEXT_LENGTH = 200;
const LOGIN_WALL_MAX_LENGTH = 1500;
const LOGIN_WORDS = /\b(sign in|log in|sign up|join now)\b/i;

/** Turns a loaded page into document text, preferring a structured job posting. */
export function extractDocument(page: PageSnapshot): { name: string; text: string } {
  const name = new URL(page.url).host;
  const posting = findJobPosting(page.jsonLd);
  if (posting) return { name, text: postingText(posting) };

  const text = normalizeText(page.text);
  if (looksLikeLoginWall(text)) {
    throw new Error(
      `${name} wants you to sign in before showing this page. Paste the text instead.`,
    );
  }
  if (text.length < MIN_TEXT_LENGTH) {
    throw new Error("Couldn't read any text from that page. Paste the text instead.");
  }
  return { name, text };
}

/** Readable plain text from an HTML fragment: blocks become paragraphs, list items dashes. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/?(p|div|h[1-6]|ul|ol|section|article|blockquote|pre|table|tr)\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  return normalizeText(decodeEntities(text));
}

interface JobPosting {
  title?: unknown;
  hiringOrganization?: unknown;
  description?: unknown;
}

function findJobPosting(scripts: string[]): JobPosting | null {
  for (const script of scripts) {
    const found = nodes(parseJson(script)).find(
      (node) => isJobPosting(node) && typeof node.description === "string",
    );
    if (found) return found as JobPosting;
  }
  return null;
}

function postingText(posting: JobPosting): string {
  const heading = [asString(posting.title), companyName(posting.hiringOrganization)].filter(
    Boolean,
  );
  const body = htmlToText(unescapeHtml(String(posting.description)));
  return [heading.join("\n"), body].filter(Boolean).join("\n\n");
}

function companyName(organization: unknown): string {
  if (typeof organization === "string") return organization;
  return asString((organization as { name?: unknown } | null)?.name);
}

/** Every object in a JSON-LD document, flattening arrays and `@graph`. */
function nodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  return [node, ...nodes(node["@graph"])];
}

function isJobPosting(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

function looksLikeLoginWall(text: string): boolean {
  return text.length < LOGIN_WALL_MAX_LENGTH && LOGIN_WORDS.test(text);
}

/** Some sites put entity-escaped HTML in JSON-LD (`&lt;p&gt;`). */
function unescapeHtml(html: string): string {
  return !html.includes("<") && html.includes("&lt;") ? decodeEntities(html) : html;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    const point =
      code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function normalizeText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
