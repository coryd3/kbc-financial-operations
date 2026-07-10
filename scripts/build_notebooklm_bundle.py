#!/usr/bin/env python3
"""Build a single NotebookLM sourcebook from key KBC financial operations docs."""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "dist" / "notebooklm"
OUTPUT_MD = OUTPUT_DIR / "kbc-financial-operations-sourcebook.md"
OUTPUT_PDF = OUTPUT_DIR / "kbc-financial-operations-sourcebook.pdf"

SENSITIVE_WARNING = (
    "This sourcebook must not contain donor records, payroll details, bank account "
    "numbers, passwords, Social Security numbers, confidential personnel issues, "
    "or private financial data."
)


@dataclass(frozen=True)
class SourceDoc:
    title: str
    path: str
    owner: str
    note: str = ""
    include_mode: str = "full"


SOURCE_DOCS = [
    SourceDoc("Project Overview", "docs/00-project-brief.md", "Project lead TBD"),
    SourceDoc("Current Situation", "docs/01-current-state-assessment.md", "Project lead TBD"),
    SourceDoc("Responsibility Matrix", "docs/governance/responsibility-matrix.md", "Finance Committee"),
    SourceDoc(
        "Treasurer vs. Bookkeeper Distinction",
        "docs/roles/treasurer-vs-bookkeeper-duty-split.md",
        "Finance Committee",
    ),
    SourceDoc(
        "Bookkeeper Job Description",
        "docs/roles/bookkeeper-financial-administrator-job-description.md",
        "Personnel Committee",
    ),
    SourceDoc(
        "Bookkeeper Application Summary",
        "docs/roles/bookkeeper-job-application.md",
        "Personnel Committee",
        note=(
            "This section summarizes the draft application structure. Do not include "
            "actual applicant responses, reference notes, background-check results, "
            "or private personnel information in this sourcebook."
        ),
        include_mode="summary",
    ),
    SourceDoc("Finance Committee Charter", "docs/governance/finance-committee-charter.md", "Finance Committee"),
    SourceDoc(
        "Future Governance Expansion",
        "docs/governance/future-governance-expansion.md",
        "Pastor / Deacons / Finance Committee",
        note=(
            "This is a parking-lot governance review item. It should not be treated as approved policy "
            "or allowed to slow the immediate Bookkeeper hiring work unless an urgent issue requires action."
        ),
    ),
    SourceDoc("Reimbursement Policy", "docs/policies/reimbursement-policy.md", "Finance Committee"),
    SourceDoc("Spending Authority Policy", "docs/policies/spending-authority-policy.md", "Finance Committee"),
    SourceDoc("Credit Card Policy", "docs/policies/credit-card-policy.md", "Finance Committee"),
    SourceDoc(
        "Monthly Finance Committee Review Checklist",
        "docs/procedures/monthly-finance-committee-meeting-checklist.md",
        "Finance Committee",
    ),
    SourceDoc("Software Requirements", "docs/software-evaluation/software-requirements.md", "Finance Committee"),
    SourceDoc(
        "ChurchTrac vs. IconCMO Comparison",
        "docs/software-evaluation/icon-vs-churchtrac-comparison.md",
        "Finance Committee",
    ),
    SourceDoc("30/60/90 Roadmap", "docs/implementation-roadmap.md", "Finance Committee / project lead TBD"),
    SourceDoc("Open Questions", "docs/03-open-questions.md", "Project lead TBD"),
    SourceDoc("Decision Log", "docs/02-decision-log.md", "Project lead TBD"),
    SourceDoc(
        "Constitution and Bylaws Reference",
        "docs/governance/constitution-and-bylaws-reference.md",
        "Church / Clerk TBD",
        note=(
            "This sourcebook includes the reference page and review questions, not the full PDF. "
            "Check the Constitution, Bylaws, and Covenant PDF before making final governance decisions."
        ),
    ),
    SourceDoc(
        "Leadership Review Packet Summary",
        "docs/communications/leadership-review-packet.md",
        "Pastor / leadership team",
    ),
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def status_from_text(text: str) -> str:
    match = re.search(r"^Status:\s*(.+)$", text, flags=re.MULTILINE)
    return match.group(1).strip() if match else "TBD"


def git_last_updated(path: str) -> str:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", path],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        result = None

    if result and result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()

    full_path = ROOT / path
    if full_path.exists():
        return datetime.fromtimestamp(full_path.stat().st_mtime).date().isoformat()

    return "TBD"


def demote_headings(markdown: str) -> str:
    lines = []
    for line in markdown.splitlines():
        if line.startswith("#"):
            lines.append("##" + line)
        else:
            lines.append(line)
    return "\n".join(lines).strip()


def summarize_application(markdown: str) -> str:
    sections = []
    current_heading = None
    current_lines: list[str] = []

    for line in markdown.splitlines():
        if line.startswith("## "):
            if current_heading:
                sections.append((current_heading, current_lines))
            current_heading = line.removeprefix("## ").strip()
            current_lines = []
        elif current_heading:
            current_lines.append(line)

    if current_heading:
        sections.append((current_heading, current_lines))

    output = [
        "The draft Bookkeeper / Financial Administrator application collects information in these areas:",
        "",
    ]

    for heading, lines in sections:
        if heading.lower().startswith("applicant statement"):
            purpose = "Applicant certification, signature, and acknowledgment language."
        elif "Applicant Information" in heading:
            purpose = "Basic contact information and applicant identity fields."
        elif "Employment Information" in heading:
            purpose = "Employment eligibility, conflict-of-interest, and church relationship questions."
        elif "Availability" in heading:
            purpose = "Availability, schedule, and timing questions."
        elif "Bookkeeping" in heading:
            purpose = "Experience with bookkeeping, accounting, reconciliations, payroll, reports, and nonprofit or church finance."
        elif "Software" in heading:
            purpose = "Experience with spreadsheets, accounting tools, church management systems, and document handling."
        elif "Confidentiality" in heading:
            purpose = "Questions about accuracy, confidentiality, documentation, and handling sensitive records."
        elif "Church And Ministry" in heading:
            purpose = "Church/ministry perspective and comfort serving in a church financial support role."
        elif "References" in heading:
            purpose = "Reference contact fields. Actual reference responses should not be stored in this sourcebook."
        else:
            sample = " ".join(x.strip() for x in lines if x.strip())
            purpose = sample[:180] + ("..." if len(sample) > 180 else "")
        output.append(f"- **{heading}:** {purpose}")

    output.extend(
        [
            "",
            "Needs Personnel Review: Personnel Committee should finalize application wording, screening steps, and secure storage for applicant materials before use.",
            "",
            "Needs Professional Review: Employment eligibility, background-check, privacy, and authorization language should be reviewed by an appropriate advisor before use.",
        ]
    )
    return "\n".join(output)


def section_for_doc(doc: SourceDoc) -> str:
    source_path = ROOT / doc.path
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source document: {doc.path}")

    text = read_text(source_path)
    status = status_from_text(text)
    updated = git_last_updated(doc.path)
    body = summarize_application(text) if doc.include_mode == "summary" else demote_headings(text)

    metadata = [
        f"# {doc.title}",
        "",
        f"- Source file path: `{doc.path}`",
        f"- Status: {status}",
        f"- Owner: {doc.owner}",
        f"- Last updated: {updated}",
    ]
    if doc.note:
        metadata.append(f"- Note: {doc.note}")

    return "\n".join(metadata) + "\n\n---\n\n" + body


def build_markdown() -> str:
    generated_on = date.today().isoformat()
    sections = [
        "# KBC Financial Operations Sourcebook",
        "",
        f"Generated: {generated_on}",
        "",
        f"> **Sensitive Information Warning:** {SENSITIVE_WARNING}",
        "",
        "This sourcebook is a single-file reading copy for NotebookLM. It gathers the most important current KBC financial operations documents so leaders can ask questions across the material.",
        "",
        "The GitHub repository remains the source of truth. If this sourcebook is out of date, update the Markdown source files and run `make notebooklm` again.",
        "",
        "## Included Sources",
        "",
    ]

    for doc in SOURCE_DOCS:
        sections.append(f"- [{doc.title}](#{slugify(doc.title)}): `{doc.path}`")

    sections.extend(["", "---", ""])
    sections.extend(section_for_doc(doc) for doc in SOURCE_DOCS)
    sections.extend(
        [
            "",
            "---",
            "",
            "# Sourcebook Review Notes",
            "",
            "- This file should be reviewed before uploading to NotebookLM.",
            "- Do not add confidential financial, donor, payroll, bank, password, personnel, applicant, reference-check, background-check, or private pastoral care details.",
            "- If a leader asks NotebookLM a question, verify the answer against the source Markdown and the latest committee decisions before acting.",
        ]
    )
    return "\n".join(sections).strip() + "\n"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9 -]", "", value.lower())
    slug = re.sub(r"\s+", "-", slug.strip())
    return slug


def build_pdf() -> bool:
    pandoc = shutil.which("pandoc")
    if not pandoc:
        print("NotebookLM PDF skipped: Pandoc is not installed or not on PATH.")
        return False

    command = [
        pandoc,
        str(OUTPUT_MD),
        "-o",
        str(OUTPUT_PDF),
        "--metadata",
        "title=KBC Financial Operations Sourcebook",
        "--toc",
    ]
    result = subprocess.run(command, cwd=ROOT, check=False, capture_output=True, text=True)
    if result.returncode == 0:
        return True

    print("NotebookLM PDF skipped: Pandoc could not create the PDF.")
    if result.stderr.strip():
        print(result.stderr.strip())
    return False


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_MD.write_text(build_markdown(), encoding="utf-8")

    pdf_created = build_pdf()
    if not pdf_created and OUTPUT_PDF.exists():
        OUTPUT_PDF.unlink()

    print("NotebookLM sourcebook created:")
    print(f"- {OUTPUT_MD.relative_to(ROOT)}")
    if pdf_created:
        print(f"- {OUTPUT_PDF.relative_to(ROOT)}")
    else:
        print("- PDF not created. The Markdown sourcebook is ready to upload.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
