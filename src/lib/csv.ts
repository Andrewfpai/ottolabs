/**
 * RFC 4180 CSV, safe to open in a spreadsheet.
 *
 * Notes and titles are free text you typed, and a cell that starts with `=`,
 * `+`, `-` or `@` is run as a formula by Excel and Sheets. A note reading
 * `=HYPERLINK(...)` would become a live link the moment the export is opened.
 * Such text cells get a leading apostrophe, which spreadsheets hide and treat
 * as "this is text". Numbers are written as numbers and left alone.
 */
export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";

  const text = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  // CRLF per RFC 4180; a BOM so Excel reads it as UTF-8 rather than mangling
  // every non-ASCII character in a title.
  const lines = [header, ...rows].map((row) => row.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
