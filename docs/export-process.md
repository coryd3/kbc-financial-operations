# Export and Release Process

This page explains how to turn the public Markdown artifacts in `dist/` into review files and release bundles.

## What To Edit

Edit the Markdown source files in `dist/`:

- `dist/leadership-review-packet.md`
- `dist/one-page-congregational-summary.md`
- `dist/congregational-slide-deck.md`

Do not edit generated PDF, DOCX, or PPTX files as the long-term source. Regenerate them from Markdown instead.

## Export Review Files

Run:

```sh
make export
```

This creates PDF, DOCX, and PPTX review files in `dist/exports/` and then validates them.

## Validate Existing Exports

Run:

```sh
make validate
```

Validation checks that the expected files exist, are not zero bytes, have readable file structure, meet page-count expectations, and do not include internal metadata lines.

## Clean Generated Files

Run:

```sh
make clean
```

This removes generated files from `dist/exports/`. It does not remove dated release bundles.

## Create a Release Packet

Run:

```sh
make release
```

This runs export and validation, creates a dated folder under `dist/releases/YYYY-MM-DD/`, copies the generated files into that folder, creates `dist/releases/YYYY-MM-DD.zip`, and prints the release paths.

## Review Status Labels

Use clear review status language in document titles, notes, or release communication:

- Draft
- Committee Review
- Ready for Vote
- Approved
- Superseded

## Sensitive Information Warning

Do not store donor records, payroll details, bank account numbers, Social Security numbers, passwords, candidate applications, background-check results, or confidential personnel information in this repository or in generated release packets.
