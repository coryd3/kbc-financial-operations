import type { HistoryInstance, Timeliness } from "./api";
import { ROLE_LABELS, RECURRENCE_LABELS, type ChecklistTemplate } from "@shared/schema";
import { format } from "date-fns";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function timelinessLabel(timeliness: Timeliness, status: string): string {
  if (timeliness === "on_time") return "On time";
  if (timeliness === "late") return "Completed late";
  if (timeliness === "overdue") return "Overdue";
  return status === "completed" ? "Completed" : "In progress";
}

function timelinessClass(timeliness: Timeliness, status: string): string {
  if (timeliness === "on_time") return "ok";
  if (timeliness === "late") return "warn";
  if (timeliness === "overdue") return "bad";
  return status === "completed" ? "ok" : "muted";
}

const fmtDate = (d: string | Date) => format(new Date(d), "MMM d, yyyy");
const fmtDateTime = (d: string | Date) => format(new Date(d), "MMM d, yyyy 'at' h:mm a");

// Opens a clean, print-friendly audit report of a checklist template's run
// history (all runs expanded with step-level who/when detail) and triggers
// the browser's print dialog.
export function openChecklistHistoryPrintView(template: ChecklistTemplate, instances: HistoryInstance[]) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to use the print view.");
    return;
  }

  const completedRuns = instances.filter((i) => i.status === "completed");
  const onTimeRuns = completedRuns.filter((i) => i.timeliness === "on_time");
  const withDue = completedRuns.filter((i) => i.timeliness === "on_time" || i.timeliness === "late");
  const onTimeRate = withDue.length > 0 ? `${Math.round((onTimeRuns.length / withDue.length) * 100)}%` : "—";

  const runSections = instances
    .map((run) => {
      const meta: string[] = [];
      if (run.periodKey) meta.push(`Period ${esc(run.periodKey)}`);
      meta.push(`Started ${esc(fmtDate(run.createdAt))}`);
      if (run.dueDate) meta.push(`Due ${esc(fmtDate(run.dueDate))}`);
      if (run.completedAt) meta.push(`Completed ${esc(fmtDateTime(run.completedAt))}`);
      meta.push(`${run.progress.completed}/${run.progress.total} steps done`);

      const stepRows =
        run.steps.length === 0
          ? `<tr><td colspan="4" class="muted">This run had no steps.</td></tr>`
          : run.steps
              .map((step) => {
                const done = !!step.completedAt;
                return `<tr>
<td class="num">${step.position}.</td>
<td>${esc(step.title)}${step.assignedRole ? ` <span class="role">${esc(ROLE_LABELS[step.assignedRole])}</span>` : ""}</td>
<td>${done ? esc(step.completedByName ?? "Unknown") : `<span class="muted">—</span>`}</td>
<td>${done ? esc(fmtDateTime(step.completedAt!)) : `<span class="muted">Not completed</span>`}</td>
</tr>`;
              })
              .join("\n");

      return `<section class="run">
<div class="run-head">
  <h2>${esc(run.name)}</h2>
  <span class="badge ${timelinessClass(run.timeliness, run.status)}">${esc(timelinessLabel(run.timeliness, run.status))}</span>
</div>
<div class="run-meta">${meta.join(" &middot; ")}</div>
<table>
<thead><tr><th class="num">#</th><th>Step</th><th>Completed By</th><th>When</th></tr></thead>
<tbody>
${stepRows}
</tbody>
</table>
</section>`;
    })
    .join("\n");

  const generatedOn = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(template.name)} — Run History</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 2rem; }
  h1 { font-size: 1.4rem; margin: 0 0 0.15rem; }
  .meta { font-size: 0.8rem; color: #555; margin-bottom: 0.35rem; }
  .stats { font-size: 0.85rem; margin: 0.75rem 0 1.5rem; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; display: inline-block; }
  .run { margin-bottom: 1.5rem; break-inside: avoid; }
  .run-head { display: flex; align-items: baseline; gap: 10px; }
  h2 { font-size: 1.05rem; margin: 0 0 0.1rem; }
  .run-meta { font-size: 0.75rem; color: #555; margin-bottom: 0.4rem; }
  .badge { font-size: 0.68rem; padding: 2px 8px; border-radius: 3px; border: 1px solid; white-space: nowrap; }
  .badge.ok { color: #166534; border-color: #166534; }
  .badge.warn { color: #92400e; border-color: #92400e; }
  .badge.bad { color: #991b1b; border-color: #991b1b; }
  .badge.muted { color: #555; border-color: #999; }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ccc; vertical-align: top; }
  th { border-bottom: 2px solid #333; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td.num, th.num { width: 2rem; color: #777; }
  tr { break-inside: avoid; }
  .role { font-size: 0.68rem; color: #555; border: 1px solid #bbb; border-radius: 3px; padding: 0 4px; white-space: nowrap; }
  .muted { color: #999; }
  .footer { margin-top: 1.5rem; font-size: 0.7rem; color: #777; }
  @media print {
    body { margin: 0.5in; }
  }
</style>
</head>
<body>
<h1>${esc(template.name)} — Run History</h1>
<div class="meta">${esc(RECURRENCE_LABELS[template.recurrence])} checklist${template.description ? " &middot; " + esc(template.description) : ""}</div>
<div class="meta">Generated ${esc(generatedOn)}</div>
<div class="stats">
  <strong>${instances.length}</strong> total run${instances.length === 1 ? "" : "s"} &middot;
  <strong>${completedRuns.length}</strong> completed &middot;
  <strong>${esc(onTimeRate)}</strong> on time
</div>
${runSections || `<p class="muted">No checklists have been started from this template yet.</p>`}
<div class="footer">Kingsville Baptist Church &mdash; checklist audit report, for church use only.</div>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
