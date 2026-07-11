#!/usr/bin/env python3
"""Build a comprehensive document bundle and a TTS-friendly listening script."""

from __future__ import annotations

import html
import re
import subprocess
import sys
from argparse import ArgumentParser
from csv import DictWriter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "dist" / "audiobook"
COMPLETE_MD = OUTPUT_DIR / "kbc-financial-operations-complete-document.md"
TTS_TXT = OUTPUT_DIR / "kbc-financial-operations-tts-script.txt"
CHUNKS_DIR = OUTPUT_DIR / "chunks"
CHUNK_INDEX = OUTPUT_DIR / "chunk-index.csv"
DEFAULT_MAX_CHARS = 4500

SENSITIVE_WARNING = (
    "Do not include donor records, payroll details, bank account numbers, passwords, "
    "Social Security numbers, confidential personnel issues, actual applications, "
    "reference checks, background-check results, or private financial data in this file."
)


@dataclass(frozen=True)
class DocEntry:
    group: str
    title: str
    path: str


@dataclass(frozen=True)
class TtsChapter:
    group: str
    title: str
    status: str
    text: str


@dataclass(frozen=True)
class TtsChunk:
    sequence: int
    group: str
    title: str
    part: int
    path: Path
    characters: int
    words: int


DOCS: list[DocEntry] = [
    DocEntry("Start Here", "Handbook And Workspace Home", "docs/index.md"),
    DocEntry("Start Here", "Why This Handbook Exists", "docs/start-here/why-this-exists.md"),
    DocEntry("Start Here", "Handbook And Workspace Stewardship", "docs/document-stewardship.md"),
    DocEntry("Handbook - Governance", "Constitution and Bylaws Reference", "docs/governance/constitution-and-bylaws-reference.md"),
    DocEntry("Handbook - Governance", "Church Organization Chart", "docs/governance/church-organization-chart.md"),
    DocEntry("Handbook - Governance", "Financial Operations View", "docs/governance/financial-operations-view.md"),
    DocEntry("Handbook - Governance", "Responsibility Matrix", "docs/governance/responsibility-matrix.md"),
    DocEntry("Handbook - Governance", "Finance Committee Charter", "docs/governance/finance-committee-charter.md"),
    DocEntry("Handbook - Governance", "Personnel Committee Role", "docs/governance/personnel-committee-role.md"),
    DocEntry("Handbook - Roles", "Treasurer Governance Role", "docs/roles/treasurer-governance-role.md"),
    DocEntry("Handbook - Roles", "Bookkeeper Job Description", "docs/roles/bookkeeper-financial-administrator-job-description.md"),
    DocEntry("Handbook - Finance Operations", "Spending Authority Policy", "docs/policies/spending-authority-policy.md"),
    DocEntry("Handbook - Finance Operations", "Reimbursement Policy", "docs/policies/reimbursement-policy.md"),
    DocEntry("Handbook - Finance Operations", "Reimbursement Process", "docs/procedures/reimbursement-process.md"),
    DocEntry("Handbook - Finance Operations", "Credit Card Policy", "docs/policies/credit-card-policy.md"),
    DocEntry("Handbook - Finance Operations", "Offering Counting and Deposit Policy", "docs/policies/offering-counting-and-deposit-policy.md"),
    DocEntry("Handbook - Finance Operations", "Monthly Financial Review Policy", "docs/policies/monthly-financial-review-policy.md"),
    DocEntry("Handbook - Finance Operations", "Monthly Finance Committee Checklist", "docs/procedures/monthly-finance-committee-meeting-checklist.md"),
    DocEntry("Handbook - Finance Operations", "Contribution Entry Process", "docs/procedures/contribution-entry-process.md"),
    DocEntry("Handbook - Finance Operations", "Weekly Bookkeeping Checklist", "docs/procedures/weekly-bookkeeping-checklist.md"),
    DocEntry("Handbook - Finance Operations", "Monthly Close Checklist", "docs/procedures/monthly-close-checklist.md"),
    DocEntry("Handbook - Finance Operations", "Business Meeting Report Process", "docs/procedures/business-meeting-report-process.md"),
    DocEntry("Handbook - Finance Operations", "Payroll Process", "docs/procedures/payroll-process.md"),
    DocEntry("Handbook - Finance Operations", "Audit and Review Policy", "docs/policies/audit-and-review-policy.md"),
    DocEntry("Current Work - 2026 Transition", "Current Work Dashboard", "docs/start-here/project-dashboard.md"),
    DocEntry("Current Work - 2026 Transition", "Transition Project Brief", "docs/00-project-brief.md"),
    DocEntry("Current Work - 2026 Transition", "Transition Current-State Assessment", "docs/01-current-state-assessment.md"),
    DocEntry("Current Work - 2026 Transition", "Transition Roadmap", "docs/implementation-roadmap.md"),
    DocEntry("Current Work - 2026 Transition", "Decision Log", "docs/02-decision-log.md"),
    DocEntry("Current Work - 2026 Transition", "Issue Register", "docs/03-open-questions.md"),
    DocEntry("Current Work - 2026 Transition", "Leadership Review Overview", "docs/leadership-review/index.md"),
    DocEntry("Current Work - 2026 Transition", "Leadership Review Packet", "docs/communications/leadership-review-packet.md"),
    DocEntry("Current Work - 2026 Transition", "Personnel Committee Packet", "docs/communications/personnel-committee-packet.md"),
    DocEntry("Current Work - 2026 Transition", "Finance Committee Packet", "docs/communications/finance-committee-packet.md"),
    DocEntry("Current Work - 2026 Transition", "Personnel Committee Recommendation", "docs/communications/personnel-committee-recommendation.md"),
    DocEntry("Current Work - 2026 Transition", "Finance Committee Recommendation", "docs/communications/finance-committee-recommendation.md"),
    DocEntry("Current Work - 2026 Transition", "Deacon Update", "docs/communications/deacon-update.md"),
    DocEntry("Current Work - 2026 Transition", "Treasurer vs. Bookkeeper Duty Analysis", "docs/roles/treasurer-vs-bookkeeper-duty-split.md"),
    DocEntry("Current Work - 2026 Transition", "Interim Treasurer Role", "docs/roles/interim-treasurer-role.md"),
    DocEntry("Current Work - 2026 Transition", "Bookkeeper Application", "docs/roles/bookkeeper-job-application.md"),
    DocEntry("Current Work - 2026 Transition", "Bookkeeper Hiring Process", "docs/roles/bookkeeper-hiring-process.md"),
    DocEntry("Current Work - 2026 Transition", "Job Description Consistency Check", "docs/roles/job-description-consistency-check.md"),
    DocEntry("Current Work - Policy Review", "Financial Authority Review Package", "docs/policies/financial-authority-policy-package.md"),
    DocEntry("Current Work - Governance", "Future Governance Expansion", "docs/governance/future-governance-expansion.md"),
    DocEntry("Current Work - Software", "Software Requirements", "docs/software-evaluation/software-requirements.md"),
    DocEntry("Current Work - Software", "Demo Scorecard", "docs/software-evaluation/demo-scorecard.md"),
    DocEntry("Current Work - Software", "IconCMO vs. ChurchTrac Comparison", "docs/software-evaluation/icon-vs-churchtrac-comparison.md"),
    DocEntry("Current Work - Software", "Implementation Plan", "docs/software-evaluation/implementation-plan.md"),
    DocEntry("Communications", "Church Business Meeting Summary", "docs/communications/church-business-meeting-summary.md"),
    DocEntry("Communications", "One-Page Congregational Summary", "docs/communications/one-page-congregational-summary.md"),
    DocEntry("Communications", "Congregational Slide Outline", "docs/communications/congregational-slide-outline.md"),
    DocEntry("Administration And Archive", "Superseded Project Dashboard", "docs/project-dashboard.md"),
    DocEntry("Administration And Archive", "Document Inventory", "docs/document-inventory.md"),
    DocEntry("Administration And Archive", "Export Process", "docs/export-process.md"),
    DocEntry("Administration And Archive", "Exported Files and Release Bundles", "docs/exports-and-releases.md"),
    DocEntry("Administration And Archive", "Document Workflow Notes", "docs/document-workflow-upgrade-notes.md"),
]


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8").strip()


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


def demote_headings(markdown: str, levels: int = 2) -> str:
    lines = []
    for line in markdown.splitlines():
        if line.startswith("#"):
            lines.append("#" * levels + line)
        else:
            lines.append(line)
    return "\n".join(lines).strip()


def clean_inline_markdown(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("`", "")
    text = text.replace("**", "").replace("__", "")
    text = re.sub(r"(?<!\w)_([^_]+)_(?!\w)", r"\1", text)
    text = text.replace("<br>", ", ").replace("<br/>", ", ").replace("<br />", ", ")
    text = re.sub(r"\{#[^}]+\}", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_table_row(row: str) -> list[str]:
    row = row.strip().strip("|")
    return [clean_inline_markdown(cell.strip()) for cell in row.split("|")]


def is_table_separator(row: str) -> bool:
    row = row.strip()
    if not row.startswith("|"):
        return False
    return bool(re.fullmatch(r"[\s|:.-]+", row))


def table_to_speech(table_lines: list[str]) -> list[str]:
    rows = [line for line in table_lines if line.strip().startswith("|") and not is_table_separator(line)]
    if not rows:
        return []

    headers = split_table_row(rows[0])
    data_rows = [split_table_row(row) for row in rows[1:]]
    spoken = ["Table summary."]

    for cells in data_rows:
        if not any(cells):
            continue
        parts = []
        for index, cell in enumerate(cells):
            if not cell:
                continue
            header = headers[index] if index < len(headers) and headers[index] else f"Column {index + 1}"
            parts.append(f"{header}: {cell}")
        if parts:
            spoken.append(". ".join(parts) + ".")

    return spoken


def remove_yaml_or_metadata_noise(text: str) -> str:
    lines = []
    in_front_matter = False
    for index, line in enumerate(text.splitlines()):
        if index == 0 and line.strip() == "---":
            in_front_matter = True
            continue
        if in_front_matter:
            if line.strip() == "---":
                in_front_matter = False
            continue
        if re.match(r"^Status:\s*", line.strip(), flags=re.IGNORECASE):
            continue
        lines.append(line)
    return "\n".join(lines)


def code_block_to_tts(match: re.Match[str]) -> str:
    info = match.group(1).strip().lower()
    body = match.group(2).strip()

    if info == "mermaid" or re.search(r"\b(flowchart|graph)\b", body):
        return "\nDiagram omitted. See the handbook site for the visual version.\n"

    one_line = clean_inline_markdown(body.replace("\r\n", "\n").replace("\n", "; "))
    if not one_line:
        return ""

    if len(one_line) <= 220:
        return f"\nCommand or example: {one_line}.\n"

    return "\nTechnical example omitted from the listening script.\n"


def markdown_to_tts(markdown: str) -> str:
    markdown = remove_yaml_or_metadata_noise(markdown)
    markdown = re.sub(r"```([^\n]*)\n([\s\S]*?)```", code_block_to_tts, markdown)

    output: list[str] = []
    lines = markdown.splitlines()
    index = 0

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if stripped.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            output.extend(table_to_speech(table_lines))
            output.append("")
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            title = clean_inline_markdown(heading.group(2))
            output.extend(["", f"Section: {title}.", ""])
            index += 1
            continue

        if not stripped:
            output.append("")
            index += 1
            continue

        admonition = re.match(r"^!!!\s+(\w+)(?:\s+\"([^\"]+)\")?", stripped)
        if admonition:
            label = admonition.group(2) or admonition.group(1).title()
            output.extend(["", f"{admonition.group(1).title()}: {label}."])
            index += 1
            continue

        stripped = re.sub(r"^>\s?", "", stripped)
        stripped = re.sub(r"^[-*+]\s+\[[ xX]\]\s+", "", stripped)
        stripped = re.sub(r"^[-*+]\s+", "", stripped)
        stripped = re.sub(r"^\d+[.)]\s+", "", stripped)
        spoken = clean_inline_markdown(stripped)

        if spoken:
            if not re.search(r"[.!?:;]$", spoken):
                spoken += "."
            output.append(spoken)

        index += 1

    text = "\n".join(output)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_complete_markdown() -> str:
    generated = date.today().isoformat()
    sections = [
        "# KBC Financial Operations Complete Document",
        "",
        f"Generated: {generated}",
        "",
        f"> **Sensitive Information Warning:** {SENSITIVE_WARNING}",
        "",
        "This compiled document gathers the current handbook, current-work records, and safe historical references in the same general order as the handbook site. The repository Markdown files remain the source of truth.",
        "",
        "## Included Documents",
        "",
    ]

    current_group = ""
    for doc in DOCS:
        if doc.group != current_group:
            current_group = doc.group
            sections.append(f"### {current_group}")
            sections.append("")
        sections.append(f"- {doc.title}: `{doc.path}`")

    current_group = ""
    for doc in DOCS:
        text = read_text(doc.path)
        status = status_from_text(text)
        updated = git_last_updated(doc.path)

        if doc.group != current_group:
            current_group = doc.group
            sections.extend(["", "---", "", f"# {current_group}", ""])

        sections.extend(
            [
                f"## {doc.title}",
                "",
                f"- Source file path: `{doc.path}`",
                f"- Status: {status}",
                f"- Last updated: {updated}",
                "",
                demote_headings(text, levels=2),
                "",
            ]
        )

    return "\n".join(sections).strip() + "\n"


def build_tts_script() -> str:
    generated = date.today().isoformat()
    sections = [
        "KBC Financial Operations Listening Script.",
        "",
        f"Generated on {generated}.",
        "",
        "This is a text to speech version of the current KBC financial operations handbook and workspace.",
        "The goal is to help leaders listen through the material without reading every document on screen.",
        "",
        f"Sensitive information warning. {SENSITIVE_WARNING}",
        "",
        "The GitHub repository Markdown files remain the source of truth. This listening script is generated from those files.",
        "",
    ]

    current_group = ""
    for doc in DOCS:
        text = read_text(doc.path)
        status = status_from_text(text)

        if doc.group != current_group:
            current_group = doc.group
            sections.extend(["", f"Part: {current_group}.", ""])

        sections.extend(
            [
                f"Chapter: {doc.title}.",
                f"Current document status: {status}.",
                "",
                markdown_to_tts(text),
                "",
                f"End of chapter: {doc.title}.",
                "",
            ]
        )

    sections.extend(
        [
            "End of listening script.",
            "",
            "Before making decisions, verify the latest source documents, committee minutes, church bylaws, and any needed professional guidance.",
        ]
    )
    return "\n".join(sections).strip() + "\n"


def word_count(text: str) -> int:
    return len(re.findall(r"\b\S+\b", text))


def slugify(value: str) -> str:
    slug = value.lower()
    slug = slug.replace("&", "and")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "section"


def build_chapters() -> list[TtsChapter]:
    chapters: list[TtsChapter] = []
    current_group = ""
    for doc in DOCS:
        text = read_text(doc.path)
        status = status_from_text(text)

        parts = []
        if doc.group != current_group:
            current_group = doc.group
            parts.extend([f"Part: {current_group}.", ""])

        parts.extend(
            [
                f"Chapter: {doc.title}.",
                f"Current document status: {status}.",
                "",
                markdown_to_tts(text),
                "",
                f"End of chapter: {doc.title}.",
            ]
        )

        chapters.append(
            TtsChapter(
                group=doc.group,
                title=doc.title,
                status=status,
                text="\n".join(parts).strip() + "\n",
            )
        )
    return chapters


def split_text(text: str, max_chars: int) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        paragraph_len = len(paragraph)

        if paragraph_len > max_chars:
            if current:
                chunks.append("\n\n".join(current).strip())
                current = []
                current_len = 0
            chunks.extend(split_long_paragraph(paragraph, max_chars))
            continue

        next_len = current_len + paragraph_len + (2 if current else 0)
        if current and next_len > max_chars:
            chunks.append("\n\n".join(current).strip())
            current = [paragraph]
            current_len = paragraph_len
        else:
            current.append(paragraph)
            current_len = next_len

    if current:
        chunks.append("\n\n".join(current).strip())

    return chunks


def split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            chunks.extend(sentence[i : i + max_chars].strip() for i in range(0, len(sentence), max_chars))
            continue
        if current and len(current) + len(sentence) + 1 > max_chars:
            chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip()

    if current:
        chunks.append(current.strip())

    return chunks


def clear_generated_chunks() -> None:
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
    for path in CHUNKS_DIR.glob("*.txt"):
        path.unlink()


def write_chunks(chapters: list[TtsChapter], max_chars: int) -> list[TtsChunk]:
    clear_generated_chunks()
    chunks: list[TtsChunk] = []
    sequence = 1

    intro = (
        "KBC Financial Operations Listening Script.\n\n"
        f"Generated on {date.today().isoformat()}.\n\n"
        "This is a text to speech version of the current KBC financial operations handbook and workspace.\n"
        "The GitHub repository Markdown files remain the source of truth.\n\n"
        f"Sensitive information warning. {SENSITIVE_WARNING}\n"
    )
    sequence = write_chunk_group(
        chunks=chunks,
        sequence=sequence,
        group="Introduction",
        title="Introduction",
        text=intro,
        max_chars=max_chars,
    )

    for chapter in chapters:
        sequence = write_chunk_group(
            chunks=chunks,
            sequence=sequence,
            group=chapter.group,
            title=chapter.title,
            text=chapter.text,
            max_chars=max_chars,
        )

    write_chunk_index(chunks)
    return chunks


def write_chunk_group(
    *,
    chunks: list[TtsChunk],
    sequence: int,
    group: str,
    title: str,
    text: str,
    max_chars: int,
) -> int:
    parts = split_text(text, max_chars)
    total_parts = len(parts)
    group_slug = slugify(group)
    title_slug = slugify(title)

    for part_index, part_text in enumerate(parts, start=1):
        part_label = f"part-{part_index:02d}" if total_parts > 1 else "part-01"
        filename = f"{sequence:03d}-{group_slug}-{title_slug}-{part_label}.txt"
        path = CHUNKS_DIR / filename
        path.write_text(part_text.strip() + "\n", encoding="utf-8")
        chunks.append(
            TtsChunk(
                sequence=sequence,
                group=group,
                title=title,
                part=part_index,
                path=path,
                characters=len(part_text),
                words=word_count(part_text),
            )
        )
        sequence += 1

    return sequence


def write_chunk_index(chunks: list[TtsChunk]) -> None:
    with CHUNK_INDEX.open("w", encoding="utf-8", newline="") as handle:
        writer = DictWriter(
            handle,
            fieldnames=[
                "sequence",
                "file",
                "group",
                "title",
                "part",
                "characters",
                "words",
            ],
        )
        writer.writeheader()
        for chunk in chunks:
            writer.writerow(
                {
                    "sequence": chunk.sequence,
                    "file": chunk.path.relative_to(ROOT).as_posix(),
                    "group": chunk.group,
                    "title": chunk.title,
                    "part": chunk.part,
                    "characters": chunk.characters,
                    "words": chunk.words,
                }
            )


def parse_args() -> object:
    parser = ArgumentParser(description="Build audiobook, TTS script, and chapter chunk files.")
    parser.add_argument(
        "--max-chars",
        type=int,
        default=DEFAULT_MAX_CHARS,
        help=f"Maximum characters per chunk file. Default: {DEFAULT_MAX_CHARS}.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.max_chars < 1000:
        print("Audiobook bundle could not be created. --max-chars must be at least 1000.")
        return 1

    missing = [doc.path for doc in DOCS if not (ROOT / doc.path).exists()]
    if missing:
        print("Audiobook bundle could not be created. Missing source files:")
        for path in missing:
            print(f"- {path}")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    complete = build_complete_markdown()
    tts = build_tts_script()
    chunks = write_chunks(build_chapters(), args.max_chars)

    COMPLETE_MD.write_text(complete, encoding="utf-8")
    TTS_TXT.write_text(tts, encoding="utf-8")

    tts_words = word_count(tts)
    estimated_minutes = round(tts_words / 150)

    print("Audiobook/TTS bundle created:")
    print(f"- {COMPLETE_MD.relative_to(ROOT)}")
    print(f"- {TTS_TXT.relative_to(ROOT)}")
    print(f"- {CHUNK_INDEX.relative_to(ROOT)}")
    print(f"- {CHUNKS_DIR.relative_to(ROOT)} ({len(chunks)} chunk files)")
    print(f"TTS script word count: {tts_words:,}")
    print(f"Estimated listening time at 150 words/minute: about {estimated_minutes} minutes")
    print("Review the TTS script before uploading it to a text-to-speech app.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
