# KBC Financial Operations Documentation

## Overview
A MkDocs Material documentation site for KBC financial operations modernization. Imported from GitHub. Content lives in `docs/`, configuration in `mkdocs.yml`, helper scripts in `scripts/`.

## Setup
- Python 3.12 with `mkdocs-material` (see `requirements.txt`)
- Dev server: workflow "Documentation Site" runs `python -m mkdocs serve --dev-addr 0.0.0.0:5000`
- Deployment: static, build `python -m mkdocs build`, public dir `site/`
- `Makefile` provides export/build/audio tasks (some require extra tooling like pandoc/piper)

## User preferences
(none recorded yet)
