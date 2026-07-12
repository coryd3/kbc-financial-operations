#!/usr/bin/env python3
"""Check handbook structure, metadata, and durable-content guardrails."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
METADATA_PATH = DOCS / "document-metadata.yml"
MKDOCS_PATH = ROOT / "mkdocs.yml"

PLATFORM_PATTERNS = {
    "Google Drive": re.compile(r"\bGoogle Drive\b", re.IGNORECASE),
    "GitHub": re.compile(r"\bGitHub\b", re.IGNORECASE),
    "Replit": re.compile(r"\bReplit\b", re.IGNORECASE),
    "Render hosting": re.compile(
        r"\b(?:onrender\.com|Render (?:hosting|deployment|service|database|Blueprint))\b",
        re.IGNORECASE,
    ),
}

TRANSITION_PATTERNS = {
    "Treasurer transition": re.compile(r"\bTreasurer (?:and Bookkeeper )?transition\b", re.IGNORECASE),
    "Treasurer vacancy": re.compile(r"\bTreasurer vacancy\b", re.IGNORECASE),
    "dated Bookkeeper authorization": re.compile(r"\bJune 28, 2026\b", re.IGNORECASE),
    "interim Treasurer assignment": re.compile(r"\binterim Treasurer\b", re.IGNORECASE),
}


def load_metadata() -> dict[str, dict[str, object]]:
    parsed = yaml.safe_load(METADATA_PATH.read_text(encoding="utf-8")) or {}
    records = parsed.get("documents", {})
    if not isinstance(records, dict):
        raise ValueError("docs/document-metadata.yml must contain a documents mapping")
    return records


def nav_markdown_files() -> list[str]:
    text = MKDOCS_PATH.read_text(encoding="utf-8")
    marker = "\nnav:\n"
    if marker not in text:
        raise ValueError("mkdocs.yml does not contain a nav section")
    nav_text = text.split(marker, 1)[1]
    return re.findall(r"^\s*-\s+[^:\n]+:\s+([^\s#]+\.md)\s*$", nav_text, re.MULTILINE)


def slug_for(markdown_path: str) -> str:
    return markdown_path.removesuffix(".md").replace("\\", "/")


def visible_status(text: str) -> str | None:
    match = re.search(r"^Status:\s*(.+?)\s*$", text, re.MULTILINE)
    return match.group(1) if match else None


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    try:
        metadata = load_metadata()
        nav_files = nav_markdown_files()
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(f"Document consistency audit stopped: {exc}", file=sys.stderr)
        return 2

    for relative in nav_files:
        path = DOCS / relative
        slug = slug_for(relative)
        if not path.is_file():
            failures.append(f"Navigation points to missing file: docs/{relative}")
        if slug not in metadata:
            failures.append(f"Navigation page has no metadata: docs/{relative}")

    for slug, record in metadata.items():
        path = DOCS / f"{slug}.md"
        if not path.is_file():
            failures.append(f"Metadata points to missing file: docs/{slug}.md")
            continue

        text = path.read_text(encoding="utf-8")
        expected_status = str(record.get("status", "")).strip()
        actual_status = visible_status(text)
        if not actual_status:
            failures.append(f"Missing visible Status line: docs/{slug}.md")
        elif actual_status != expected_status:
            failures.append(
                f"Status mismatch: docs/{slug}.md has '{actual_status}', metadata has '{expected_status}'"
            )

        lifecycle = str(record.get("lifecycle", "")).strip()
        if lifecycle not in {"durable", "reference"}:
            continue

        for label, pattern in PLATFORM_PATTERNS.items():
            for match in pattern.finditer(text):
                failures.append(
                    f"Platform-specific language in durable content: docs/{slug}.md:"
                    f"{line_number(text, match.start())} ({label})"
                )

        for label, pattern in TRANSITION_PATTERNS.items():
            for match in pattern.finditer(text):
                failures.append(
                    f"Time-limited project language in durable content: docs/{slug}.md:"
                    f"{line_number(text, match.start())} ({label})"
                )

    canonical_dashboard = metadata.get("project-dashboard")
    if canonical_dashboard and canonical_dashboard.get("status") != "Superseded":
        failures.append("docs/project-dashboard.md must remain marked Superseded")
    if "project-dashboard.md" in nav_files:
        failures.append("Superseded docs/project-dashboard.md must not appear in navigation")

    orientation = (DOCS / "index.md").read_text(encoding="utf-8")
    if re.search(r"\bshared folder\b", orientation, re.IGNORECASE):
        failures.append("Homepage should orient readers without comparing the handbook to a shared folder")

    metadata_slugs = set(metadata)
    nav_slugs = {slug_for(path) for path in nav_files}
    for slug in sorted(metadata_slugs - nav_slugs):
        if metadata[slug].get("status") != "Superseded":
            warnings.append(f"Metadata page is outside navigation: docs/{slug}.md")

    print("Document consistency audit")
    print("==========================")
    print(f"Navigation pages checked: {len(nav_files)}")
    print(f"Metadata records checked: {len(metadata)}")

    if failures:
        print(f"\nFAIL: {len(failures)} consistency issue(s) found.")
        for item in failures:
            print(f"  - {item}")
    else:
        print("\nPASS: Navigation, metadata, status, and durable-content guardrails are consistent.")

    if warnings:
        print(f"\nWARN: {len(warnings)} item(s) need review.")
        for item in warnings:
            print(f"  - {item}")
    else:
        print("WARN: none")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
