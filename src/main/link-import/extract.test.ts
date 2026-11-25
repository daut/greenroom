import { describe, expect, it } from "vitest";
import { extractDocument, htmlToText, type PageSnapshot } from "./extract";

const LONG_TEXT = "We build tools for people who rehearse. ".repeat(10);

function page(changes: Partial<PageSnapshot>): PageSnapshot {
  return {
    url: "https://jobs.example.com/roles/42",
    title: "Senior Engineer",
    jsonLd: [],
    text: "",
    ...changes,
  };
}

function jobPosting(extra: Record<string, unknown> = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Senior Engineer",
    hiringOrganization: { "@type": "Organization", name: "Acme" },
    description: "<p>Build things.</p><ul><li>TypeScript</li><li>Postgres</li></ul>",
    ...extra,
  };
}

describe("extractDocument", () => {
  it("names the document after the host", () => {
    expect(extractDocument(page({ text: LONG_TEXT })).name).toBe("jobs.example.com");
  });

  it("prefers JobPosting JSON-LD over page text", () => {
    const doc = extractDocument(
      page({ jsonLd: [JSON.stringify(jobPosting())], text: `Cookie banner. ${LONG_TEXT}` }),
    );
    expect(doc.text).toBe("Senior Engineer\nAcme\n\nBuild things.\n\n- TypeScript\n- Postgres");
  });

  it("finds a JobPosting inside @graph, arrays and multi-type nodes", () => {
    const graph = { "@graph": [{ "@type": "WebPage" }, jobPosting({ title: "From graph" })] };
    const array = [{ "@type": "BreadcrumbList" }, jobPosting({ title: "From array" })];
    const multi = jobPosting({ "@type": ["Thing", "JobPosting"], title: "Multi" });
    expect(extractDocument(page({ jsonLd: [JSON.stringify(graph)] })).text).toMatch(/^From graph/);
    expect(extractDocument(page({ jsonLd: [JSON.stringify(array)] })).text).toMatch(/^From array/);
    expect(extractDocument(page({ jsonLd: [JSON.stringify(multi)] })).text).toMatch(/^Multi/);
  });

  it("accepts a company given as a plain string and an HTML-escaped description", () => {
    const posting = jobPosting({
      hiringOrganization: "Acme",
      description: "&lt;p&gt;Ship &amp;amp; learn.&lt;/p&gt;",
    });
    expect(extractDocument(page({ jsonLd: [JSON.stringify(posting)] })).text).toBe(
      "Senior Engineer\nAcme\n\nShip & learn.",
    );
  });

  it("skips broken JSON-LD and falls back to page text", () => {
    const doc = extractDocument(
      page({ jsonLd: ["{not json"], text: `  ${LONG_TEXT}\n\n\n\nEnd ` }),
    );
    expect(doc.text).toBe(`${LONG_TEXT.trim()}\n\nEnd`);
  });

  it("ignores a JobPosting without a description", () => {
    const posting = jobPosting({ description: undefined });
    const doc = extractDocument(page({ jsonLd: [JSON.stringify(posting)], text: LONG_TEXT }));
    expect(doc.text).toBe(LONG_TEXT.trim());
  });

  it("rejects pages with too little text", () => {
    expect(() => extractDocument(page({ text: "Loading…" }))).toThrow(
      "Couldn't read any text from that page. Paste the text instead.",
    );
  });

  it("rejects login walls", () => {
    const wall = `Sign in to see this job. ${"Join now to see who you already know. ".repeat(8)}`;
    expect(() =>
      extractDocument(page({ url: "https://www.linkedin.com/jobs/view/1", text: wall })),
    ).toThrow("www.linkedin.com wants you to sign in");
  });
});

describe("htmlToText", () => {
  it("keeps paragraphs, line breaks and list items readable", () => {
    expect(htmlToText("<h2>About</h2><p>One<br>Two</p><ol><li>A</li><li>B</li></ol>")).toBe(
      "About\n\nOne\nTwo\n\n- A\n- B",
    );
  });

  it("decodes entities and drops scripts and styles", () => {
    expect(
      htmlToText(
        "<style>p{}</style><p>R&amp;D &lt;3&nbsp;it&rsquo;s &#8212; &#x2019; &unknown;</p><script>x()</script>",
      ),
    ).toBe("R&D <3 it’s — ’ &unknown;");
  });

  it("collapses whitespace inside blocks", () => {
    expect(htmlToText("<p>  lots \n\n of   space </p>")).toBe("lots of space");
  });
});
