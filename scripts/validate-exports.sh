#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

EXPORT_DIR="dist/exports"
WORK_DIR="$(mktemp -d)"

EXPECTED_FILES=(
  "dist/exports/leadership-review-packet.pdf"
  "dist/exports/leadership-review-packet.docx"
  "dist/exports/one-page-congregational-summary.pdf"
  "dist/exports/one-page-congregational-summary.docx"
  "dist/exports/congregational-slide-deck.pptx"
  "dist/exports/congregational-slide-deck.pdf"
)

failures=()
warnings=()
validated_files=()

trap 'rm -rf "${WORK_DIR}"' EXIT

add_failure() {
  failures+=("$1")
}

add_warning() {
  warnings+=("$1")
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

check_required_tools() {
  if ! has_command unzip; then
    add_failure "Missing validation tool: unzip is required to inspect DOCX and PPTX files."
  fi

  if ! has_command pdfinfo; then
    add_failure "Missing validation tool: pdfinfo is required to check PDF page counts."
  fi

  if ! has_command pdftotext; then
    add_failure "Missing validation tool: pdftotext is required to scan PDF text."
  fi
}

file_size() {
  wc -c < "$1" 2>/dev/null | tr -d '[:space:]'
}

check_expected_files() {
  local file_path
  local size

  for file_path in "${EXPECTED_FILES[@]}"; do
    if [[ ! -f "${file_path}" ]]; then
      add_failure "Missing expected export: ${file_path}"
      continue
    fi

    size="$(file_size "${file_path}")"
    if [[ -z "${size}" || "${size}" -eq 0 ]]; then
      add_failure "Export is zero bytes: ${file_path}"
      continue
    fi

    validated_files+=("${file_path}")
  done
}

check_pdf_header() {
  local file_path="$1"
  local header

  [[ -f "${file_path}" ]] || return

  header="$(LC_ALL=C head -c 5 "${file_path}" 2>/dev/null || true)"
  if [[ "${header}" != "%PDF-" ]]; then
    add_failure "PDF header is invalid: ${file_path}"
  fi
}

pdf_pages() {
  local file_path="$1"

  pdfinfo "${file_path}" 2>/dev/null \
    | awk -F: '/^Pages:/ { gsub(/[[:space:]]/, "", $2); print $2; exit }'
}

check_pdf_pages_exact() {
  local file_path="$1"
  local expected_pages="$2"
  local pages

  [[ -f "${file_path}" && "$(file_size "${file_path}")" -gt 0 ]] || return
  has_command pdfinfo || return

  pages="$(pdf_pages "${file_path}")"
  if [[ "${pages}" != "${expected_pages}" ]]; then
    add_failure "${file_path} should be exactly ${expected_pages} page(s), but appears to be ${pages:-unknown}."
  fi
}

check_pdf_pages_max() {
  local file_path="$1"
  local max_pages="$2"
  local pages

  [[ -f "${file_path}" && "$(file_size "${file_path}")" -gt 0 ]] || return
  has_command pdfinfo || return

  pages="$(pdf_pages "${file_path}")"
  if [[ -z "${pages}" ]]; then
    add_failure "Could not determine page count for ${file_path}."
  elif (( pages > max_pages )); then
    add_failure "${file_path} should be no more than ${max_pages} pages, but appears to be ${pages}."
  fi
}

check_zip_entry() {
  local file_path="$1"
  local entry_path="$2"

  has_command unzip || return
  [[ -f "${file_path}" ]] || return

  if ! unzip -Z1 "${file_path}" 2>/dev/null | grep -Fxq "${entry_path}"; then
    add_failure "Expected file inside archive was not found: ${file_path} -> ${entry_path}"
  fi
}

check_docx_structure() {
  local file_path="$1"

  has_command unzip || return
  [[ -f "${file_path}" && "$(file_size "${file_path}")" -gt 0 ]] || return

  if ! unzip -tq "${file_path}" >/dev/null 2>&1; then
    add_failure "DOCX archive check failed: ${file_path}"
    return
  fi

  check_zip_entry "${file_path}" "[Content_Types].xml"
  check_zip_entry "${file_path}" "word/document.xml"
}

check_pptx_structure() {
  local file_path="$1"

  has_command unzip || return
  [[ -f "${file_path}" && "$(file_size "${file_path}")" -gt 0 ]] || return

  if ! unzip -tq "${file_path}" >/dev/null 2>&1; then
    add_failure "PPTX archive check failed: ${file_path}"
    return
  fi

  check_zip_entry "${file_path}" "[Content_Types].xml"
  check_zip_entry "${file_path}" "ppt/presentation.xml"
  check_zip_entry "${file_path}" "ppt/slides/slide1.xml"
  check_zip_entry "${file_path}" "ppt/slides/slide10.xml"
}

extract_pdf_text() {
  local file_path="$1"
  local text_path="$2"

  has_command pdftotext || return 1
  pdftotext -layout "${file_path}" "${text_path}" >/dev/null 2>&1
}

extract_docx_text() {
  local file_path="$1"
  local text_path="$2"

  has_command unzip || return 1
  unzip -p "${file_path}" "word/document.xml" 2>/dev/null \
    | sed 's/<[^>]*>/ /g' > "${text_path}"
}

extract_pptx_text() {
  local file_path="$1"
  local text_path="$2"

  has_command unzip || return 1
  {
    unzip -p "${file_path}" "ppt/slides/*.xml" 2>/dev/null || true
    unzip -p "${file_path}" "ppt/notesSlides/*.xml" 2>/dev/null || true
  } | sed 's/<[^>]*>/ /g' > "${text_path}"
}

scan_for_internal_metadata() {
  local file_path="$1"
  local text_path="$2"
  local label="$3"

  if grep -Eq '(^|[[:space:]])Purpose:' "${text_path}"; then
    add_failure "Internal metadata found in ${label}: Purpose:"
  fi

  if grep -Eq '(^|[[:space:]])Status:' "${text_path}"; then
    add_failure "Internal metadata found in ${label}: Status:"
  fi

  if grep -Fq 'Draft for congregational sharing' "${text_path}"; then
    add_failure "Internal metadata found in ${label}: Draft for congregational sharing"
  fi
}

scan_for_bad_pdf_text() {
  local file_path="$1"
  local text_path="$2"
  local replacement_char
  local soft_hyphen
  local hyphen_lines

  replacement_char="$(printf '\357\277\275')"
  soft_hyphen="$(printf '\302\255')"

  if grep -Fq "${replacement_char}" "${text_path}"; then
    add_failure "Replacement character found in PDF text: ${file_path}"
  fi

  if grep -Fq "${soft_hyphen}" "${text_path}"; then
    add_failure "Soft hyphen character found in PDF text: ${file_path}"
  fi

  hyphen_lines="$(awk '
    previous ~ /[[:alpha:]][[:alpha:]]-$/ && $0 ~ /^[[:space:]]*[[:alpha:]][[:alpha:]]/ {
      print NR - 1
    }
    { previous = $0 }
  ' "${text_path}")"

  if [[ -n "${hyphen_lines}" ]]; then
    add_warning "Possible line-break hyphenation in ${file_path} near extracted text line(s): ${hyphen_lines//$'\n'/, }"
  fi
}

scan_export_text() {
  local file_path="$1"
  local text_path="${WORK_DIR}/$(basename "${file_path}").txt"

  [[ -f "${file_path}" && "$(file_size "${file_path}")" -gt 0 ]] || return

  case "${file_path}" in
    *.pdf)
      if extract_pdf_text "${file_path}" "${text_path}"; then
        scan_for_internal_metadata "${file_path}" "${text_path}" "${file_path}"
        scan_for_bad_pdf_text "${file_path}" "${text_path}"
      else
        add_failure "Could not extract PDF text for validation: ${file_path}"
      fi
      ;;
    *.docx)
      if extract_docx_text "${file_path}" "${text_path}"; then
        scan_for_internal_metadata "${file_path}" "${text_path}" "${file_path}"
      else
        add_failure "Could not extract DOCX text for validation: ${file_path}"
      fi
      ;;
    *.pptx)
      if extract_pptx_text "${file_path}" "${text_path}"; then
        scan_for_internal_metadata "${file_path}" "${text_path}" "${file_path}"
      else
        add_failure "Could not extract PPTX text for validation: ${file_path}"
      fi
      ;;
  esac
}

print_summary() {
  printf '\nValidation results:\n'

  if (( ${#failures[@]} == 0 )); then
    printf '  PASS: All required validation checks passed.\n'
  else
    printf '  FAIL: %s validation issue(s) found.\n' "${#failures[@]}"
  fi

  if (( ${#warnings[@]} == 0 )); then
    printf '  Warnings: none\n'
  else
    printf '  Warnings needing manual review: %s\n' "${#warnings[@]}"
  fi

  printf '\nFiles checked:\n'
  local validated_file
  for validated_file in "${validated_files[@]}"; do
    printf '  - %s\n' "${validated_file}"
  done

  if (( ${#failures[@]} > 0 )); then
    printf '\nFailures:\n'
    local failure
    for failure in "${failures[@]}"; do
      printf '  - %s\n' "${failure}"
    done
  fi

  if (( ${#warnings[@]} > 0 )); then
    printf '\nWarnings:\n'
    local warning
    for warning in "${warnings[@]}"; do
      printf '  - %s\n' "${warning}"
    done
  fi
}

main() {
  printf 'Validating generated review files...\n'

  if [[ ! -d "${EXPORT_DIR}" ]]; then
    add_failure "Export folder does not exist yet: ${EXPORT_DIR}. Run make export first."
    print_summary
    exit 1
  fi

  check_required_tools
  check_expected_files

  check_pdf_header "${EXPORT_DIR}/leadership-review-packet.pdf"
  check_pdf_header "${EXPORT_DIR}/one-page-congregational-summary.pdf"
  check_pdf_header "${EXPORT_DIR}/congregational-slide-deck.pdf"

  check_docx_structure "${EXPORT_DIR}/leadership-review-packet.docx"
  check_docx_structure "${EXPORT_DIR}/one-page-congregational-summary.docx"
  check_pptx_structure "${EXPORT_DIR}/congregational-slide-deck.pptx"

  check_pdf_pages_exact "${EXPORT_DIR}/one-page-congregational-summary.pdf" 1
  check_pdf_pages_max "${EXPORT_DIR}/leadership-review-packet.pdf" 12

  local export_file
  for export_file in "${EXPECTED_FILES[@]}"; do
    scan_export_text "${export_file}"
  done

  print_summary

  if (( ${#failures[@]} > 0 )); then
    exit 1
  fi
}

main "$@"
