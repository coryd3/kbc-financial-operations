#!/usr/bin/env python3
"""Convert returned Finance Committee DOCX files into a safe review workspace."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "review-intake" / "finance"


def fail(message: str) -> None:
    raise SystemExit(f"Finance review ingestion stopped: {message}")


def run(command: list[str]) -> str:
    result = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True)
    if result.returncode:
        details = (result.stderr or result.stdout).strip()
        fail(f"command failed: {' '.join(command)}\n{details}")
    return result.stdout


def safe_extract(archive: Path, destination: Path) -> None:
    destination_root = destination.resolve()
    with ZipFile(archive) as bundle:
        for member in bundle.infolist():
            target = (destination / member.filename).resolve()
            if destination_root not in target.parents and target != destination_root:
                fail(f"unsafe path in ZIP archive: {member.filename}")
        bundle.extractall(destination)


def source_body(markdown: str) -> str:
    lines = markdown.splitlines()
    status_index = next((index for index, line in enumerate(lines[:15]) if line.startswith("Status:")), None)
    if status_index is not None:
        lines = lines[status_index + 1 :]
    else:
        while lines and (not lines[0].strip() or lines[0].startswith("# ")):
            lines.pop(0)
    while lines and not lines[0].strip():
        lines.pop(0)
    return "\n".join(lines).rstrip() + "\n"


def returned_body(markdown: str) -> str:
    match = re.search(r"(?m)^#{1,3}\s+Document Content\s*$", markdown)
    if not match:
        return markdown.rstrip() + "\n"
    return markdown[match.end() :].lstrip().rstrip() + "\n"


def find_returned_docx(root: Path, configured_name: str, slug: str) -> Path | None:
    direct = list(root.rglob(configured_name))
    if direct:
        return direct[0]
    candidates = [path for path in root.rglob("*.docx") if slug in path.name and not path.name.startswith("~$")]
    return candidates[0] if len(candidates) == 1 else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Returned review folder or ZIP file")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    pandoc = shutil.which("pandoc")
    if not pandoc:
        fail("Pandoc is required. Install Pandoc or run this process in a prepared development environment.")
    input_path = args.input.resolve()
    if not input_path.exists():
        fail(f"input does not exist: {input_path}")

    with tempfile.TemporaryDirectory(prefix="kbc-finance-intake-") as temporary:
        temporary_root = Path(temporary)
        if input_path.is_file():
            if input_path.suffix.lower() != ".zip":
                fail("input file must be a ZIP archive; a directory may also be supplied")
            safe_extract(input_path, temporary_root)
            review_root = temporary_root
        else:
            review_root = input_path

        manifests = list(review_root.rglob("manifest.json"))
        if len(manifests) != 1:
            fail(f"expected exactly one manifest.json, found {len(manifests)}")
        manifest = json.loads(manifests[0].read_text(encoding="utf-8"))
        batch = manifest.get("batch_timestamp", "unknown-batch")
        intake_stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%SZ")
        output_dir = args.output_root.resolve() / f"{batch}--ingested-{intake_stamp}"
        output_dir.mkdir(parents=True, exist_ok=False)

        summary = [
            "# Finance Committee Review Intake",
            "",
            f"Export batch: {batch}",
            f"Source commit: `{manifest.get('source_commit', 'unknown')}`",
            f"Ingested: {intake_stamp}",
            "",
            "This workspace contains review input only. It must not overwrite repository Markdown automatically.",
            "Inspect comments and tracked changes, verify committee authority, update the Markdown source deliberately, and then rerun the normal audits and exports.",
            "",
            "## Documents",
            "",
        ]
        converted_count = 0
        missing_count = 0
        for item in manifest.get("documents", []):
            returned_docx = find_returned_docx(review_root, item["docx"], item["slug"])
            if not returned_docx:
                missing_count += 1
                summary.extend([f"### {item['title']}", "", "Returned DOCX: not found", ""])
                continue

            converted_count += 1
            converted_path = output_dir / f"{item['slug']}--returned.md"
            media_dir = output_dir / "media" / item["slug"]
            run([
                pandoc,
                str(returned_docx),
                "--from", "docx",
                "--to", "gfm",
                "--track-changes=all",
                "--wrap=none",
                f"--extract-media={media_dir}",
                "--output", str(converted_path),
            ])
            converted = converted_path.read_text(encoding="utf-8")
            proposal = returned_body(converted)
            proposal_path = output_dir / f"{item['slug']}--proposed-body.md"
            proposal_path.write_text(proposal, encoding="utf-8")

            source_path = item["source_path"]
            snapshot = manifests[0].parent / item.get("source_snapshot", "")
            if snapshot.is_file():
                snapshot_sha256 = hashlib.sha256(snapshot.read_bytes()).hexdigest()
                if snapshot_sha256 != item.get("source_sha256"):
                    fail(f"source snapshot failed its integrity check: {snapshot}")
                base_markdown = snapshot.read_text(encoding="utf-8-sig")
            else:
                try:
                    base_markdown = run(["git", "show", f"{manifest['source_commit']}:{source_path}"])
                except SystemExit:
                    base_markdown = (REPO_ROOT / source_path).read_text(encoding="utf-8-sig")
            current_blob = run(["git", "hash-object", source_path]).strip()
            source_changed = current_blob != item.get("source_blob")
            diff_text = "".join(difflib.unified_diff(
                source_body(base_markdown).splitlines(keepends=True),
                proposal.splitlines(keepends=True),
                fromfile=f"exported/{source_path}",
                tofile=f"returned/{returned_docx.name}",
            ))
            diff_path = output_dir / f"{item['slug']}--review.diff"
            diff_path.write_text(diff_text or "No body-text difference detected.\n", encoding="utf-8")
            summary.extend([
                f"### {item['title']}",
                "",
                f"- Canonical source: `{source_path}`",
                f"- Returned file: `{returned_docx.name}`",
                f"- Source changed since export: {'YES - rebase review carefully' if source_changed else 'No'}",
                f"- Converted review: `{converted_path.name}`",
                f"- Proposed body: `{proposal_path.name}`",
                f"- Comparison: `{diff_path.name}`",
                "",
            ])

        summary.extend([
            "## Next Steps",
            "",
            "1. Read the converted review and comparison files.",
            "2. Resolve unclear comments with the reviewer or document owner.",
            "3. Apply accepted changes to the canonical Markdown source, not to generated files.",
            "4. Preserve status, owner, approval body, and bylaw/professional-review safeguards.",
            "5. Run `make audit-docs`, `make audit-public`, and `make finance-review` for the next review round.",
            "",
            f"Converted documents: {converted_count}",
            f"Documents without a returned DOCX: {missing_count}",
            "",
            "Word conversion may create formatting-only differences. Review every proposed change before applying it.",
        ])
        (output_dir / "review-summary.md").write_text("\n".join(summary) + "\n", encoding="utf-8")

    print("Finance review intake created:")
    print(f"- {output_dir.relative_to(REPO_ROOT)}")
    print(f"- Converted documents: {converted_count}")
    print(f"- Missing returned documents: {missing_count}")
    print("No canonical Markdown files were changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
