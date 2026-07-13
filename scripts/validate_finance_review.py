#!/usr/bin/env python3
"""Validate the generated Finance Committee DOCX/PDF review packet."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile


REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPO_ROOT / "dist" / "finance-review"
WORD_NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_text(path: Path) -> str:
    try:
        with ZipFile(path) as bundle:
            if bundle.testzip() is not None:
                raise ValueError("contains a corrupt ZIP member")
            document = ElementTree.fromstring(bundle.read("word/document.xml"))
    except (BadZipFile, KeyError, ElementTree.ParseError, ValueError) as error:
        raise ValueError(f"invalid DOCX: {error}") from error
    return " ".join(node.text or "" for node in document.iter(f"{WORD_NAMESPACE}t"))


def main() -> int:
    manifests = sorted(OUTPUT_ROOT.glob("*/manifest.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not manifests:
        print("FAIL: No Finance Committee review manifest was found.")
        return 1
    manifest_path = manifests[0]
    batch_dir = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    timestamp = manifest.get("batch_timestamp", "")
    documents = manifest.get("documents", [])
    failures: list[str] = []

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}_\d{6}Z", timestamp):
        failures.append(f"Invalid batch timestamp: {timestamp!r}")
    if not documents:
        failures.append("Manifest contains no documents.")

    for item in documents:
        title = item.get("title", "Untitled document")
        for field in ("docx", "pdf", "source_snapshot"):
            relative = item.get(field, "")
            path = batch_dir / relative
            if not relative or not path.is_file():
                failures.append(f"{title}: missing {field}: {relative}")
            elif path.stat().st_size == 0:
                failures.append(f"{title}: zero-byte {field}: {relative}")

        docx = batch_dir / item.get("docx", "")
        if docx.is_file():
            try:
                text = docx_text(docx)
                if title not in text:
                    failures.append(f"{title}: title not found in DOCX content")
                if manifest.get("exported_at", "") not in text:
                    failures.append(f"{title}: export timestamp not found in DOCX content")
            except ValueError as error:
                failures.append(f"{title}: {error}")

        pdf = batch_dir / item.get("pdf", "")
        if pdf.is_file() and not pdf.read_bytes()[:5] == b"%PDF-":
            failures.append(f"{title}: PDF signature is invalid")

        snapshot = batch_dir / item.get("source_snapshot", "")
        if snapshot.is_file():
            digest = hashlib.sha256(snapshot.read_bytes()).hexdigest()
            if digest != item.get("source_sha256"):
                failures.append(f"{title}: source snapshot hash does not match the manifest")

        for field in ("docx", "pdf"):
            if timestamp and timestamp not in item.get(field, ""):
                failures.append(f"{title}: {field} filename does not contain the batch timestamp")

    archives = list(OUTPUT_ROOT.glob(f"kbc-finance-review-{timestamp}.zip")) if timestamp else []
    if len(archives) != 1 or archives[0].stat().st_size == 0:
        failures.append("Expected timestamped packet ZIP was not created.")

    print("Finance Committee review validation")
    print("===================================")
    print(f"Batch: {timestamp or 'unknown'}")
    print(f"Documents: {len(documents)}")
    print(f"DOCX files: {len(list(batch_dir.glob('*.docx')))}")
    print(f"PDF files: {len(list(batch_dir.glob('*.pdf')))}")
    if failures:
        print(f"\nFAIL: {len(failures)} issue(s) found.")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("\nPASS: Every configured document has a timestamped DOCX, PDF, source snapshot, and valid manifest entry.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
