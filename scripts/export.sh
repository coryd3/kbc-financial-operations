#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

EXPORT_DIR="dist/exports"
WORK_DIR="$(mktemp -d)"

LEADERSHIP_SRC="dist/leadership-review-packet.md"
SUMMARY_SRC="dist/one-page-congregational-summary.md"
SLIDES_SRC="dist/congregational-slide-deck.md"

generated_files=()

trap 'rm -rf "${WORK_DIR}"' EXIT

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

find_libreoffice() {
  local command_name

  for command_name in soffice libreoffice; do
    if command -v "${command_name}" >/dev/null 2>&1; then
      printf '%s\n' "${command_name}"
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

  if ! command -v unzip >/dev/null 2>&1; then
    missing+=("unzip")
  fi

  if ! command -v zip >/dev/null 2>&1; then
    missing+=("zip")
  fi

  if ! command -v perl >/dev/null 2>&1; then
    missing+=("perl")
  fi

  if ! command -v pdfinfo >/dev/null 2>&1; then
    missing+=("pdfinfo")
  fi

  if ! command -v pdftotext >/dev/null 2>&1; then
    missing+=("pdftotext")
  fi

  LIBREOFFICE_CMD="$(find_libreoffice || true)"
  if [[ -z "${LIBREOFFICE_CMD}" ]]; then
    missing+=("LibreOffice")
  fi

  if (( ${#missing[@]} > 0 )); then
    cat >&2 <<'EOF'

Export tools are missing.

Please install:
  - Pandoc: https://pandoc.org/installing.html
  - LibreOffice: https://www.libreoffice.org/download/download-libreoffice/
  - Marp CLI: npm install -g @marp-team/marp-cli
  - Poppler tools: pdfinfo and pdftotext
  - zip, unzip, and perl

After installing the tools, run:
  make export

EOF
    printf 'Missing command(s): %s\n' "${missing[*]}" >&2
    exit 1
  fi
}

prepare_public_markdown() {
  local source_file="$1"
  local prepared_file="${WORK_DIR}/$(basename "${source_file}")"

  grep -Ev '^(Purpose:|Status:)[[:space:]]*' "${source_file}" \
    | grep -Fv 'Draft for congregational sharing' \
    > "${prepared_file}"

  printf '%s\n' "${prepared_file}"
}

polish_docx() {
  local docx_file="$1"
  local output_name="$2"
  local docx_dir="${WORK_DIR}/docx-${output_name}"
  local rebuilt_docx="${WORK_DIR}/${output_name}.docx"
  local font_size="22"
  local margin="1080"
  local spacing_after="120"
  local line_spacing="276"

  if [[ "${output_name}" == "one-page-congregational-summary" ]]; then
    font_size="18"
    margin="540"
    spacing_after="60"
    line_spacing="220"
  fi

  rm -rf "${docx_dir}"
  mkdir -p "${docx_dir}"

  unzip -q "${docx_file}" -d "${docx_dir}" \
    || fail "Could not open generated DOCX for polishing: ${docx_file}"

  if [[ -f "${docx_dir}/word/settings.xml" ]]; then
    perl -0pi -e '
      if (/<w:autoHyphenation\b[^>]*\/>/) {
        s/<w:autoHyphenation\b[^>]*\/>/<w:autoHyphenation w:val="false"\/>/g;
      } else {
        s#</w:settings>#<w:autoHyphenation w:val="false"/></w:settings>#;
      }
    ' "${docx_dir}/word/settings.xml"
  fi

  if [[ -f "${docx_dir}/word/document.xml" ]]; then
    perl -0pi -e "s#<w:pgMar\\b[^>]*/>#<w:pgMar w:top=\"${margin}\" w:right=\"${margin}\" w:bottom=\"${margin}\" w:left=\"${margin}\" w:header=\"360\" w:footer=\"360\" w:gutter=\"0\"/>#g" \
      "${docx_dir}/word/document.xml"

    perl -0pi -e 's#<w:pPr>(<w:pStyle w:val="Heading[1-3]"[^/]*/>)#<w:pPr><w:keepNext/>$1#g' \
      "${docx_dir}/word/document.xml"

    perl -0pi -e 's#<w:trPr>#<w:trPr><w:cantSplit/>#g' \
      "${docx_dir}/word/document.xml"

    perl -0pi -e 's#<w:tr>(?!<w:trPr>)#<w:tr><w:trPr><w:cantSplit/></w:trPr>#g' \
      "${docx_dir}/word/document.xml"
  fi

  if [[ -f "${docx_dir}/word/styles.xml" ]]; then
    perl -0pi -e "
      my \$defaults = '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"Liberation Sans\" w:hAnsi=\"Liberation Sans\" w:eastAsia=\"Liberation Sans\" w:cs=\"Liberation Sans\"/><w:sz w:val=\"${font_size}\"/><w:szCs w:val=\"${font_size}\"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:suppressAutoHyphens/><w:spacing w:after=\"${spacing_after}\" w:line=\"${line_spacing}\" w:lineRule=\"auto\"/></w:pPr></w:pPrDefault></w:docDefaults>';
      if (/<w:docDefaults>.*?<\/w:docDefaults>/s) {
        s#<w:docDefaults>.*?</w:docDefaults>#\$defaults#s;
      } else {
        s#(<w:styles\b[^>]*>)#\$1\$defaults#s;
      }
    " "${docx_dir}/word/styles.xml"
  fi

  (cd "${docx_dir}" && zip -qr "${rebuilt_docx}" .) \
    || fail "Could not rebuild polished DOCX: ${docx_file}"

  mv "${rebuilt_docx}" "${docx_file}"
}

convert_docx_to_pdf() {
  local docx_file="$1"
  local pdf_file="$2"
  local output_name="$3"
  local converted_pdf="${WORK_DIR}/${output_name}.pdf"
  local conversion_log="${WORK_DIR}/${output_name}-libreoffice.log"

  rm -f "${converted_pdf}" "${pdf_file}"

  "${LIBREOFFICE_CMD}" --headless --convert-to pdf --outdir "${WORK_DIR}" "${docx_file}" \
    > "${conversion_log}" 2>&1 \
    || {
      cat "${conversion_log}" >&2
      fail "LibreOffice could not convert ${docx_file} to PDF."
    }

  if [[ ! -f "${converted_pdf}" ]]; then
    cat "${conversion_log}" >&2
    fail "LibreOffice did not create the expected PDF: ${converted_pdf}"
  fi

  mv "${converted_pdf}" "${pdf_file}"
}

export_document() {
  local source_file="$1"
  local output_name="$2"
  local prepared_file
  local pdf_file="${EXPORT_DIR}/${output_name}.pdf"
  local docx_file="${EXPORT_DIR}/${output_name}.docx"

  printf 'Exporting %s\n' "${source_file}"
  prepared_file="$(prepare_public_markdown "${source_file}")"

  pandoc "${prepared_file}" \
    --standalone \
    --from markdown \
    --to docx \
    --output "${docx_file}"

  polish_docx "${docx_file}" "${output_name}"
  convert_docx_to_pdf "${docx_file}" "${pdf_file}" "${output_name}"

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
  printf 'Document PDFs are generated by converting DOCX files with LibreOffice: %s\n\n' "${LIBREOFFICE_CMD}"

  export_document "${LEADERSHIP_SRC}" "leadership-review-packet"
  export_document "${SUMMARY_SRC}" "one-page-congregational-summary"
  export_slides

  printf '\nGenerated files:\n'
  local generated_file
  for generated_file in "${generated_files[@]}"; do
    printf '  - %s\n' "${generated_file}"
  done

  printf '\nRunning export validation...\n'
  "${SCRIPT_DIR}/validate-exports.sh"

  printf '\nDone. Markdown files remain the source of truth; exported files are generated review copies.\n'
}

main "$@"
