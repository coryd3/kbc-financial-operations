import { format } from "date-fns";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "TBD";
  try {
    return format(new Date(d + "T00:00:00"), "MMMM d, yyyy");
  } catch {
    return d;
  }
}

function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #1a1a1a;
    margin: 0 auto;
    padding: 48px 56px;
    max-width: 800px;
    line-height: 1.55;
    font-size: 14px;
  }
  header.doc-header {
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 16px;
    margin-bottom: 28px;
  }
  header.doc-header .org { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #555; }
  header.doc-header h1 { font-size: 24px; margin: 6px 0 2px; }
  header.doc-header .subtitle { font-size: 15px; color: #333; margin: 0; }
  h2.section {
    font-size: 12px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #555;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
    margin: 26px 0 8px;
  }
  p { margin: 0 0 8px; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .meta-table td { padding: 3px 0; vertical-align: top; }
  .meta-table td.label { width: 130px; font-weight: bold; color: #444; font-size: 13px; }
  table.log { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  table.log th {
    text-align: left;
    border-bottom: 2px solid #1a1a1a;
    padding: 6px 8px;
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  table.log td { border-bottom: 1px solid #ddd; padding: 8px; vertical-align: top; }
  table.log tr { page-break-inside: avoid; }
  ul.decisions { padding-left: 20px; margin: 4px 0; }
  ul.decisions li { margin-bottom: 8px; }
  .decision-meta { font-size: 12px; color: #555; }
  .empty { color: #777; font-style: italic; }
  footer.doc-footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 11px;
    color: #777;
    display: flex;
    justify-content: space-between;
  }
  .signature-block { margin-top: 48px; display: flex; gap: 48px; page-break-inside: avoid; }
  .signature-block .line { flex: 1; }
  .signature-block .rule { border-bottom: 1px solid #1a1a1a; height: 36px; }
  .signature-block .caption { font-size: 11px; color: #555; margin-top: 4px; }
  @media print {
    body { padding: 0; max-width: none; }
  }
`;

function openPrintWindow(title: string, bodyHtml: string): boolean {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
${bodyHtml}
<script>
  window.addEventListener("load", function () {
    setTimeout(function () { window.print(); }, 150);
  });
</script>
</body>
</html>`);
  win.document.close();
  win.focus();
  return true;
}

function docFooter(): string {
  const generated = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
  return `<footer class="doc-footer">
    <span>Kingsville Baptist Church Operations Portal</span>
    <span>Generated ${escapeHtml(generated)}</span>
  </footer>`;
}

export type PrintableMeeting = {
  title: string;
  meetingDate: string;
  attendees: string | null;
  agenda: string | null;
  minutes: string | null;
};

export type PrintableMeetingDecision = {
  decision: string;
  decisionDate: string | null;
  statusLabel: string;
  owner: string | null;
  notes: string | null;
};

export function printMeetingMinutes(
  committeeName: string,
  meeting: PrintableMeeting,
  linkedDecisions: PrintableMeetingDecision[],
): boolean {
  const sections: string[] = [];

  sections.push(`<header class="doc-header">
    <div class="org">Kingsville Baptist Church</div>
    <h1>${escapeHtml(committeeName)}</h1>
    <p class="subtitle">Meeting Minutes — ${escapeHtml(meeting.title)}</p>
  </header>`);

  sections.push(`<table class="meta-table">
    <tr><td class="label">Meeting Date</td><td>${escapeHtml(formatDate(meeting.meetingDate))}</td></tr>
    <tr><td class="label">Committee</td><td>${escapeHtml(committeeName)}</td></tr>
    <tr><td class="label">Attendees</td><td>${
      meeting.attendees ? multiline(meeting.attendees) : '<span class="empty">Not recorded</span>'
    }</td></tr>
  </table>`);

  sections.push(`<h2 class="section">Agenda</h2>
  ${meeting.agenda ? `<p>${multiline(meeting.agenda)}</p>` : '<p class="empty">No agenda recorded.</p>'}`);

  sections.push(`<h2 class="section">Minutes</h2>
  ${meeting.minutes ? `<p>${multiline(meeting.minutes)}</p>` : '<p class="empty">No minutes recorded.</p>'}`);

  sections.push(`<h2 class="section">Decisions from this Meeting</h2>
  ${
    linkedDecisions.length
      ? `<ul class="decisions">${linkedDecisions
          .map(
            (d) => `<li>
              ${multiline(d.decision)}
              <div class="decision-meta">
                ${escapeHtml(formatDate(d.decisionDate))} &middot; Status: ${escapeHtml(d.statusLabel)}${
                  d.owner ? ` &middot; Owner: ${escapeHtml(d.owner)}` : ""
                }
              </div>
              ${d.notes ? `<div class="decision-meta">Notes: ${multiline(d.notes)}</div>` : ""}
            </li>`,
          )
          .join("")}</ul>`
      : '<p class="empty">No decisions were linked to this meeting.</p>'
  }`);

  sections.push(`<div class="signature-block">
    <div class="line"><div class="rule"></div><div class="caption">Recording Secretary</div></div>
    <div class="line"><div class="rule"></div><div class="caption">Chair</div></div>
  </div>`);

  sections.push(docFooter());

  return openPrintWindow(
    `${committeeName} — Minutes — ${formatDate(meeting.meetingDate)}`,
    sections.join("\n"),
  );
}

export type PrintableDecisionRow = {
  decisionDate: string | null;
  decision: string;
  bodyName: string;
  statusLabel: string;
  owner: string | null;
  meetingTitle: string | null;
  notes: string | null;
};

export function printDecisionLog(
  subtitle: string,
  filterDescription: string,
  rows: PrintableDecisionRow[],
): boolean {
  const sections: string[] = [];

  sections.push(`<header class="doc-header">
    <div class="org">Kingsville Baptist Church</div>
    <h1>Decision Log</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
  </header>`);

  sections.push(`<table class="meta-table">
    <tr><td class="label">Filter</td><td>${escapeHtml(filterDescription)}</td></tr>
    <tr><td class="label">Entries</td><td>${rows.length}</td></tr>
  </table>`);

  sections.push(
    rows.length
      ? `<table class="log">
      <thead>
        <tr>
          <th style="width: 100px;">Date</th>
          <th>Decision</th>
          <th style="width: 120px;">Body</th>
          <th style="width: 90px;">Status</th>
          <th style="width: 110px;">Owner</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td>${escapeHtml(formatDate(r.decisionDate))}</td>
              <td>
                ${multiline(r.decision)}
                ${r.meetingTitle ? `<div class="decision-meta">From: ${escapeHtml(r.meetingTitle)}</div>` : ""}
                ${r.notes ? `<div class="decision-meta">Notes: ${multiline(r.notes)}</div>` : ""}
              </td>
              <td>${escapeHtml(r.bodyName)}</td>
              <td>${escapeHtml(r.statusLabel)}</td>
              <td>${r.owner ? escapeHtml(r.owner) : "—"}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
      : '<p class="empty">No decisions match the selected filters.</p>',
  );

  sections.push(docFooter());

  return openPrintWindow(`Decision Log — ${subtitle}`, sections.join("\n"));
}
