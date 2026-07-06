#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

EXPORT_DIR="dist/exports"
RELEASE_ROOT="dist/releases"
RELEASE_DATE="$(date +%F)"
RELEASE_DIR="${RELEASE_ROOT}/${RELEASE_DATE}"
RELEASE_ZIP="${RELEASE_ROOT}/${RELEASE_DATE}.zip"

EXPECTED_FILES=(
  "leadership-review-packet.pdf"
  "leadership-review-packet.docx"
  "one-page-congregational-summary.pdf"
  "one-page-congregational-summary.docx"
  "congregational-slide-deck.pptx"
  "congregational-slide-deck.pdf"
)

fail() {
  printf '\nRelease stopped: %s\n' "$1" >&2
  exit 1
}

check_release_tools() {
  if ! command -v zip >/dev/null 2>&1; then
    fail "The zip command is required to create a release bundle."
  fi
}

copy_exports() {
  local file_name

  rm -rf "${RELEASE_DIR}"
  mkdir -p "${RELEASE_DIR}"

  for file_name in "${EXPECTED_FILES[@]}"; do
    if [[ ! -f "${EXPORT_DIR}/${file_name}" ]]; then
      fail "Missing expected export file: ${EXPORT_DIR}/${file_name}"
    fi

    cp "${EXPORT_DIR}/${file_name}" "${RELEASE_DIR}/${file_name}"
  done

  if [[ -f "${EXPORT_DIR}/README.md" ]]; then
    cp "${EXPORT_DIR}/README.md" "${RELEASE_DIR}/README.md"
  fi
}

create_zip() {
  rm -f "${RELEASE_ZIP}"
  (cd "${RELEASE_ROOT}" && zip -qr "${RELEASE_DATE}.zip" "${RELEASE_DATE}")
}

main() {
  check_release_tools

  printf 'Creating KBC financial operations release packet...\n\n'

  SKIP_EXPORT_VALIDATION=1 "${SCRIPT_DIR}/export.sh"
  "${SCRIPT_DIR}/validate-exports.sh"

  copy_exports
  create_zip

  printf '\nRelease created:\n'
  printf '  Folder: %s\n' "${RELEASE_DIR}"
  printf '  Zip:    %s\n' "${RELEASE_ZIP}"
  printf '\nReview the release folder before sharing outside the working team.\n'
}

main "$@"
