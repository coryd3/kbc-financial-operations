import type { Response } from "express";

export function csvEscape(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Guard against CSV formula injection: if a cell would be interpreted as a
  // formula by Excel/Sheets (=, +, -, @, or tab/CR at the start), prefix it
  // with a single quote so it is treated as text.
  if (/^[\s]*[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  // BOM so Excel opens it as UTF-8.
  return "\ufeff" + lines.join("\r\n") + "\r\n";
}

export function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
