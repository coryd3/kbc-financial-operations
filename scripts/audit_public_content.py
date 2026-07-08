#!/usr/bin/env python3
"""Check the repository for content that should not be public."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

BINARY_SOURCE_EXTENSIONS = {
    ".doc",
    ".docx",
    ".pdf",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".zip",
}

ADMIN_WARNING_FILES = {
    ".gitignore",
    "AGENTS.md",
    "README.md",
    "SITE_DEPLOYMENT.md",
    "source-materials/README.md",
    "source-materials/import-manifest.md",
    "docs/document-workflow-upgrade-notes.md",
    "docs/export-process.md",
    "docs/exports-and-releases.md",
    "docs/index.md",
    "docs/start-here/project-dashboard.md",
    "dist/exports/README.md",
}

FAIL_PATTERNS = [
    ("Social Security number pattern", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    (
        "private key block",
        re.compile(r"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----"),
    ),
    (
        "password or secret assignment",
        re.compile(
            r"\b(?:password|passwd|pwd|secret)\s*[:=]\s*"
            r"(?!TBD\b|REDACTED\b|PLACEHOLDER\b|<|xxx\b|xxxx\b|$)"
            r"[^\s#\"']+",
            re.IGNORECASE,
        ),
    ),
    (
        "bank, routing, or card number assignment",
        re.compile(
            r"\b(?:bank account|account|routing|credit card)\s*(?:number|#)?\s*"
            r"[:=]\s*\d{4,}",
            re.IGNORECASE,
        ),
    ),
]

WATCHLIST_PATTERN = re.compile(
    r"\b("
    r"Social Security|SSN|routing numbers?|bank account numbers?|"
    r"credit card numbers?|login credentials?|passwords?|"
    r"actual candidate applications?|reference-check notes?|"
    r"background-check results?|donor records?|giving details?|"
    r"payroll details?|confidential personnel|private pastoral"
    r")\b",
    re.IGNORECASE,
)

SAFE_WARNING_CONTEXT = re.compile(
    r"\b("
    r"do not|must not|should not|not store|not place|keep .* out|"
    r"intentionally excluded|intentionally not imported|warning|"
    r"must not contain|sensitive information reminder"
    r")\b",
    re.IGNORECASE,
)


def git_tracked_files() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=ROOT,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"Audit stopped: could not list tracked files with git: {exc}", file=sys.stderr)
        sys.exit(2)

    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def read_text_file(path: Path) -> str | None:
    try:
        data = path.read_bytes()
    except OSError:
        return None

    if b"\0" in data:
        return None

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return data.decode("utf-8-sig")
        except UnicodeDecodeError:
            return None


def is_admin_warning_file(relative_path: str) -> bool:
    return relative_path.replace("\\", "/") in ADMIN_WARNING_FILES


def line_has_safe_warning_context(line: str) -> bool:
    return bool(SAFE_WARNING_CONTEXT.search(line))


def main() -> int:
    tracked_files = git_tracked_files()
    failures: list[str] = []
    watch_warnings: list[str] = []
    binary_source_warnings: list[str] = []
    scanned_text_files = 0

    for relative_path in tracked_files:
        normalized = relative_path.replace("\\", "/")
        path = ROOT / relative_path

        if (
            normalized.startswith("source-materials/")
            and path.suffix.lower() in BINARY_SOURCE_EXTENSIONS
        ):
            binary_source_warnings.append(normalized)

        text = read_text_file(path)
        if text is None:
            continue

        scanned_text_files += 1

        for pattern_name, pattern in FAIL_PATTERNS:
            for match in pattern.finditer(text):
                line_number = text.count("\n", 0, match.start()) + 1
                failures.append(f"{normalized}:{line_number}: {pattern_name}")

        if is_admin_warning_file(normalized):
            continue

        for line_number, line in enumerate(text.splitlines(), start=1):
            if not WATCHLIST_PATTERN.search(line):
                continue
            if line_has_safe_warning_context(line):
                continue
            watch_warnings.append(f"{normalized}:{line_number}: review high-risk term")

    print("Public content audit")
    print("====================")
    print(f"Tracked files checked: {len(tracked_files)}")
    print(f"Text files scanned: {scanned_text_files}")

    if failures:
        print(f"\nFAIL: {len(failures)} blocking issue(s) found.")
        for item in failures:
            print(f"  - {item}")
    else:
        print("\nPASS: No blocking private-data or secret patterns found.")

    warning_count = len(watch_warnings) + len(binary_source_warnings)
    if warning_count:
        print(f"\nWARN: {warning_count} item(s) need manual review before broad public sharing.")

        if watch_warnings:
            print("\nText references to review:")
            for item in watch_warnings[:40]:
                print(f"  - {item}")
            if len(watch_warnings) > 40:
                print(f"  - ... {len(watch_warnings) - 40} more")

        if binary_source_warnings:
            print("\nBinary files under source-materials/ need manual review:")
            for item in binary_source_warnings[:40]:
                print(f"  - {item}")
            if len(binary_source_warnings) > 40:
                print(f"  - ... {len(binary_source_warnings) - 40} more")
    else:
        print("WARN: none")

    print(
        "\nReminder: keep donor records, payroll details, bank data, passwords, "
        "actual applications, reference notes, background-check results, and "
        "confidential personnel details out of this public repo."
    )

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
