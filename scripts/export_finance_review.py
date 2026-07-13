#!/usr/bin/env python3
"""Export a timestamped, one-document-per-file Finance Committee review packet."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = REPO_ROOT / "config" / "finance-review-documents.json"
DEFAULT_OUTPUT = REPO_ROOT / "dist" / "finance-review"


def fail(message: str) -> None:
    raise SystemExit(f"Finance review export stopped: {message}")


def command_path(*names: str) -> str | None:
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def run(command: list[str], *, cwd: Path = REPO_ROOT) -> str:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True)
    if result.returncode:
        details = (result.stderr or result.stdout).strip()
        fail(f"command failed: {' '.join(command)}\n{details}")
    return result.stdout.strip()


def git_value(*args: str) -> str:
    return run(["git", *args])


def source_status(markdown: str) -> str:
    for line in markdown.splitlines()[:15]:
        if line.startswith("Status:"):
            return line.removeprefix("Status:").strip()
    return "Status not stated"


def source_body(markdown: str) -> str:
    lines = markdown.splitlines()
    status_index = next((index for index, line in enumerate(lines[:15]) if line.startswith("Status:")), None)
    if status_index is not None:
        body = lines[status_index + 1 :]
    else:
        body = lines[:]
        while body and (not body[0].strip() or body[0].startswith("# ")):
            body.pop(0)
    while body and not body[0].strip():
        body.pop(0)
    return "\n".join(body).rstrip() + "\n"


def review_markdown(
    *, title: str, source_path: str, status: str, exported_at: str, commit: str, body: str
) -> str:
    safe_title = title.replace('"', "'")
    return f'''---
title: "{safe_title}"
subtitle: "Finance Committee Review Copy"
date: "Exported {exported_at}"
---

# {title}

**Finance Committee Review Copy**

**Exported:** {exported_at}

**Document status:** {status}

**Source file:** `{source_path}`

**Source revision:** `{commit[:12]}`

> This timestamped copy is provided for committee review. It is not approved merely because it was exported. Please use Word comments or Track Changes and do not add donor, payroll, banking, personnel, or other private information.

# Document Content

{body}'''


def render_mermaid(markdown: str, work_dir: Path, slug: str, mermaid_cli: str | None) -> str:
    pattern = re.compile(r"```mermaid\s*\n(.*?)```", re.DOTALL)
    matches = list(pattern.finditer(markdown))
    if not matches:
        return markdown
    if not mermaid_cli:
        print(f"  Warning: Mermaid CLI is unavailable; {len(matches)} diagram(s) will remain as source code.")
        return markdown

    replacements: list[tuple[int, int, str]] = []
    for index, match in enumerate(matches, start=1):
        source = work_dir / f"{slug}-diagram-{index}.mmd"
        image = work_dir / f"{slug}-diagram-{index}.png"
        source.write_text(match.group(1).strip() + "\n", encoding="utf-8")
        command = [
            mermaid_cli,
            "--input", str(source),
            "--output", str(image),
            "--backgroundColor", "white",
            "--scale", "2",
        ]
        puppeteer_config = os.environ.get("MERMAID_PUPPETEER_CONFIG")
        if puppeteer_config:
            command.extend(["--puppeteerConfigFile", str((REPO_ROOT / puppeteer_config).resolve())])
        run(command)
        replacements.append((match.start(), match.end(), f"![{slug} diagram]({image.as_posix()})"))

    rendered = markdown
    for start, end, replacement in reversed(replacements):
        rendered = rendered[:start] + replacement + rendered[end:]
    return rendered


def write_packet_readme(batch_dir: Path, packet_title: str, exported_at: str, commit: str, count: int) -> None:
    text = f"""# {packet_title}

Exported: {exported_at}
Source revision: {commit}
Documents: {count}

## How To Review

1. Open the DOCX file for the document you are reviewing.
2. Use Microsoft Word comments or Track Changes for proposed edits.
3. Do not add donor, payroll, banking, personnel, or other private information.
4. Return the edited DOCX files together with `manifest.json`.
5. Markdown in the repository remains the source of truth. Returned files are review input and will not overwrite it automatically.

PDF files are included for easy reading. DOCX files are the preferred format for proposed edits.
"""
    (batch_dir / "README.md").write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--timestamp", help="UTC batch timestamp such as 2026-07-12_210000Z")
    args = parser.parse_args()

    pandoc = command_path("pandoc")
    libreoffice = command_path("soffice", "libreoffice")
    mermaid_cli = command_path("mmdc")
    missing = [name for name, value in (("Pandoc", pandoc), ("LibreOffice", libreoffice)) if not value]
    if missing:
        fail(f"missing tool(s): {', '.join(missing)}. Use the GitHub Action named 'Export Docs' or install the tools locally.")

    config_path = args.config.resolve()
    if not config_path.is_file():
        fail(f"configuration file not found: {config_path}")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    documents = config.get("documents", [])
    if not documents:
        fail("the document configuration is empty")

    now = datetime.now(timezone.utc)
    timestamp = args.timestamp or os.environ.get("FINANCE_REVIEW_TIMESTAMP") or now.strftime("%Y-%m-%d_%H%M%SZ")
    exported_at = now.strftime("%B %d, %Y at %H:%M UTC")
    commit = git_value("rev-parse", "HEAD")
    output_root = args.output_root.resolve()
    batch_dir = output_root / timestamp
    if batch_dir.exists():
        fail(f"output batch already exists: {batch_dir}")
    batch_dir.mkdir(parents=True)
    snapshots_dir = batch_dir / "source-snapshots"
    snapshots_dir.mkdir()

    manifest_documents: list[dict[str, str]] = []
    with tempfile.TemporaryDirectory(prefix="kbc-finance-review-") as temporary:
        work_dir = Path(temporary)
        for index, item in enumerate(documents, start=1):
            source_path = item["path"]
            source_file = REPO_ROOT / source_path
            if not source_file.is_file():
                fail(f"source document not found: {source_path}")

            markdown = source_file.read_text(encoding="utf-8-sig")
            snapshot_name = f"{item['slug']}.md"
            (snapshots_dir / snapshot_name).write_bytes(source_file.read_bytes())
            status = source_status(markdown)
            category_slug = item["category"].lower().replace(" ", "-")
            file_stem = f"{index:02d}--{category_slug}--{item['slug']}--{timestamp}"
            docx_name = f"{file_stem}.docx"
            pdf_name = f"{file_stem}.pdf"
            prepared = work_dir / f"{file_stem}.md"
            prepared.write_text(
                review_markdown(
                    title=item["title"],
                    source_path=source_path,
                    status=status,
                    exported_at=exported_at,
                    commit=commit,
                    body=render_mermaid(source_body(markdown), work_dir, item["slug"], mermaid_cli),
                ),
                encoding="utf-8",
            )

            docx_path = batch_dir / docx_name
            print(f"[{index}/{len(documents)}] {item['title']}")
            run([
                pandoc,
                str(prepared),
                "--standalone",
                "--from", "markdown",
                "--to", "docx",
                "--resource-path", str(REPO_ROOT),
                "--output", str(docx_path),
            ])
            run([
                libreoffice,
                "--headless",
                "--convert-to", "pdf",
                "--outdir", str(batch_dir),
                str(docx_path),
            ])
            generated_pdf = batch_dir / f"{file_stem}.pdf"
            if not generated_pdf.is_file() or generated_pdf.stat().st_size == 0:
                fail(f"LibreOffice did not create a usable PDF for {item['title']}")

            manifest_documents.append({
                "sequence": str(index),
                "category": item["category"],
                "title": item["title"],
                "slug": item["slug"],
                "source_path": source_path,
                "source_status": status,
                "source_blob": git_value("hash-object", source_path),
                "source_sha256": hashlib.sha256(source_file.read_bytes()).hexdigest(),
                "source_snapshot": f"source-snapshots/{snapshot_name}",
                "docx": docx_name,
                "pdf": pdf_name,
            })

    manifest = {
        "packet_title": config.get("packetTitle", "KBC Finance Committee Document Review"),
        "batch_timestamp": timestamp,
        "exported_at": exported_at,
        "source_commit": commit,
        "documents": manifest_documents,
    }
    (batch_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    with (batch_dir / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(manifest_documents[0]))
        writer.writeheader()
        writer.writerows(manifest_documents)
    write_packet_readme(batch_dir, manifest["packet_title"], exported_at, commit, len(documents))

    archive_base = output_root / f"kbc-finance-review-{timestamp}"
    archive = Path(shutil.make_archive(str(archive_base), "zip", root_dir=output_root, base_dir=timestamp))
    print("\nFinance Committee review packet created:")
    print(f"- Folder: {batch_dir.relative_to(REPO_ROOT)}")
    print(f"- ZIP: {archive.relative_to(REPO_ROOT)}")
    print(f"- {len(documents)} DOCX files and {len(documents)} PDF files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
