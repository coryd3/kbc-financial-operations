import type { DirectoryMember } from "./api";
import { MEMBER_STATUS_LABELS } from "@shared/schema";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PrintDirectoryOptions {
  title: string;
  subtitle?: string;
  members: DirectoryMember[];
  householdName: (id: number | null) => string;
  includeNotes?: boolean;
}

// Opens a clean, print-friendly window with the given member list and
// triggers the browser's print dialog. Only the data already visible to the
// current viewer is used — privacy filtering happens server-side.
export function openPrintView({ title, subtitle, members, householdName, includeNotes }: PrintDirectoryOptions) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to use the print view.");
    return;
  }

  const headerCells = ["Name", "Household", "Status", "Phone", "Email", "Address"];
  if (includeNotes) headerCells.push("Leadership Notes");

  const bodyRows = members
    .map((m) => {
      const cells = [
        `<strong>${esc(m.lastName)}, ${esc(m.firstName)}</strong>`,
        esc(householdName(m.householdId)),
        esc(MEMBER_STATUS_LABELS[m.status] ?? m.status),
        esc(m.phone ?? ""),
        esc(m.email ?? ""),
        esc(m.address ?? ""),
      ];
      if (includeNotes) cells.push(esc(m.notes ?? ""));
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("\n");

  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 2rem; }
  h1 { font-size: 1.4rem; margin: 0 0 0.15rem; }
  .meta { font-size: 0.8rem; color: #555; margin-bottom: 1.25rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ccc; vertical-align: top; }
  th { border-bottom: 2px solid #333; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
  tr { break-inside: avoid; }
  .footer { margin-top: 1.5rem; font-size: 0.7rem; color: #777; }
  @media print {
    body { margin: 0.5in; }
  }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">${subtitle ? esc(subtitle) + " &middot; " : ""}${members.length} member${members.length === 1 ? "" : "s"} &middot; Generated ${esc(generatedOn)}</div>
<table>
<thead><tr>${headerCells.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>
<div class="footer">Kingsville Baptist Church &mdash; for church use only. Please respect members' privacy.</div>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

// Navigates to a CSV export endpoint with the current filters applied.
// Session cookies are sent automatically for same-origin requests.
export function downloadCsv(
  endpoint: string,
  params: { search?: string; status?: string; householdId?: string | number },
) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.householdId) qs.set("householdId", String(params.householdId));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const a = document.createElement("a");
  a.href = `${endpoint}${suffix}`;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
