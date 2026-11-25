import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

export const DOCUMENT_EXTENSIONS = ["pdf", "txt", "md"];

/** Plain text of a CV or notes file, for use in prompts. */
export async function readDocumentText(path: string): Promise<{ name: string; text: string }> {
  const name = basename(path);
  const extension = extname(path).slice(1).toLowerCase();
  if (extension === "txt" || extension === "md") {
    return { name, text: await readFile(path, "utf8") };
  }
  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(path)));
    const { text } = await extractText(pdf, { mergePages: true });
    return { name, text: text.trim() };
  }
  throw new Error(`Can't read ${name}. Use a PDF, TXT or Markdown file.`);
}
