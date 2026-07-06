#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

EXPORT_DIR="dist/exports"

LEADERSHIP_SRC="dist/leadership-review-packet.md"
SUMMARY_SRC="dist/one-page-congregational-summary.md"
SLIDES_SRC="dist/congregational-slide-deck.md"

generated_files=()

fail() {
  printf '\nExport stopped: %s\n' "$1" >&2
  exit 1
}

check_source() {
  local source_file="$1"

  if [[ ! -f "${source_file}" ]]; then
    fail "Missing source file: ${source_file}"
  fi
}

find_pdf_engine() {
  local engine

  for engine in tectonic xelatex lualatex pdflatex typst wkhtmltopdf; do
    if command -v "${engine}" >/dev/null 2>&1; then
      printf '%s\n' "${engine}"
      return 0
    fi
  done

  return 1
}

check_tools() {
  local missing=()

  if ! command -v pandoc >/dev/null 2>&1; then
    missing+=("pandoc")
  fi

  if ! command -v marp >/dev/null 2>&1; then
    missing+=("marp")
  fi

  if (( ${#missing[@]} > 0 )); then
    cat >&2 <<'EOF'

Export tools are missing.

Please install:
  - Pandoc: https://pandoc.org/installing.html
  - Marp CLI: npm install -g @marp-team/marp-cli

For PDF exports from Pandoc, also install one PDF engine:
  - Tectonic, XeLaTeX, LuaLaTeX, pdfLaTeX, Typst, or wkhtmltopdf

After installing the tools, run:
  make export

EOF
    printf 'Missing command(s): %s\n' "${missing[*]}" >&2
    exit 1
  fi

  PDF_ENGINE="$(find_pdf_engine || true)"

  if [[ -z "${PDF_ENGINE}" ]]; then
    cat >&2 <<'EOF'

Pandoc is installed, but no PDF engine was found.

Please install one PDF engine:
  - Tectonic, XeLaTeX, LuaLaTeX, pdfLaTeX, Typst, or wkhtmltopdf

Then run:
  make export

EOF
    exit 1
  fi
}

export_document() {
  local source_file="$1"
  local output_name="$2"
  local pdf_file="${EXPORT_DIR}/${output_name}.pdf"
  local docx_file="${EXPORT_DIR}/${output_name}.docx"

  printf 'Exporting %s\n' "${source_file}"

  pandoc "${source_file}" \
    --standalone \
    --from markdown \
    --to docx \
    --output "${docx_file}"

  pandoc "${source_file}" \
    --standalone \
    --from markdown \
    --pdf-engine="${PDF_ENGINE}" \
    --output "${pdf_file}"

  generated_files+=("${pdf_file}" "${docx_file}")
}

export_slides() {
  local pptx_file="${EXPORT_DIR}/congregational-slide-deck.pptx"
  local pdf_file="${EXPORT_DIR}/congregational-slide-deck.pdf"

  printf 'Exporting %s\n' "${SLIDES_SRC}"

  marp "${SLIDES_SRC}" \
    --pptx \
    --allow-local-files \
    --output "${pptx_file}"

  marp "${SLIDES_SRC}" \
    --pdf \
    --allow-local-files \
    --output "${pdf_file}"

  generated_files+=("${pptx_file}" "${pdf_file}")
}

main() {
  mkdir -p "${EXPORT_DIR}"

  check_source "${LEADERSHIP_SRC}"
  check_source "${SUMMARY_SRC}"
  check_source "${SLIDES_SRC}"
  check_tools

  printf 'Exporting KBC review artifacts...\n'
  printf 'Only the selected Markdown files in dist/ are exported. Confidential source materials are not included.\n\n'
  printf 'Using Pandoc PDF engine: %s\n\n' "${PDF_ENGINE}"

  export_document "${LEADERSHIP_SRC}" "leadership-review-packet"
  export_document "${SUMMARY_SRC}" "one-page-congregational-summary"
  export_slides

  printf '\nGenerated files:\n'
  local generated_file
  for generated_file in "${generated_files[@]}"; do
    printf '  - %s\n' "${generated_file}"
  done

  printf '\nDone. Markdown files remain the source of truth; exported files are generated review copies.\n'
}

main "$@"
