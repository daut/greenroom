import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDocumentText } from "./documents";

const dir = mkdtempSync(join(tmpdir(), "greenroom-docs-"));

describe("readDocumentText", () => {
  it("reads plain text and markdown files", async () => {
    const file = join(dir, "cv.md");
    writeFileSync(file, "# Jane\nSenior engineer");

    expect(await readDocumentText(file)).toEqual({
      name: "cv.md",
      text: "# Jane\nSenior engineer",
    });
  });

  it("extracts text from a PDF", async () => {
    const file = join(dir, "cv.pdf");
    writeFileSync(file, minimalPdf("Jane Doe - Senior Engineer at Acme"));

    expect((await readDocumentText(file)).text).toContain("Senior Engineer at Acme");
  });

  it("rejects unsupported formats with a clear message", async () => {
    const file = join(dir, "cv.docx");
    writeFileSync(file, "x");

    await expect(readDocumentText(file)).rejects.toThrow("PDF, TXT or Markdown");
  });
});

function minimalPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
