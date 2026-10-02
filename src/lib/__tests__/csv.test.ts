import { describe, expect, it } from "vitest";

import { toCsv } from "../csv";

const body = (csv: string) => csv.replace(/^﻿/, "");

describe("toCsv", () => {
  it("writes a header and rows with CRLF line ends", () => {
    expect(body(toCsv(["a", "b"], [["x", 1]]))).toBe("a,b\r\nx,1\r\n");
  });

  it("starts with a BOM so Excel reads UTF-8", () => {
    expect(toCsv(["a"], []).startsWith("﻿")).toBe(true);
  });

  it("quotes commas, quotes and newlines", () => {
    expect(body(toCsv(["note"], [["a, b"], ['say "hi"'], ["line\nbreak"]]))).toBe(
      'note\r\n"a, b"\r\n"say ""hi"""\r\n"line\nbreak"\r\n',
    );
  });

  it("defuses text that a spreadsheet would run as a formula", () => {
    const csv = body(toCsv(["note"], [["=HYPERLINK(\"http://x\")"], ["+1"], ["-x"], ["@cmd"]]));
    expect(csv).toBe('note\r\n"\'=HYPERLINK(""http://x"")"\r\n\'+1\r\n\'-x\r\n\'@cmd\r\n');
  });

  it("leaves real numbers alone, negatives included", () => {
    expect(body(toCsv(["n"], [[-3], [2.5]]))).toBe("n\r\n-3\r\n2.5\r\n");
  });

  it("writes empty cells for null and undefined", () => {
    expect(body(toCsv(["a", "b", "c"], [[null, undefined, true]]))).toBe("a,b,c\r\n,,true\r\n");
  });

  it("keeps non-ASCII text intact", () => {
    expect(body(toCsv(["title"], [["日本語の復習"]]))).toBe("title\r\n日本語の復習\r\n");
  });
});
