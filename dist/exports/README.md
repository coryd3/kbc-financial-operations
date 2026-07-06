# Exported Review Files

This folder is for generated PDF, DOCX, and PPTX review files.

Run this from the repository root:

```sh
make export
```

To validate existing exports without regenerating them, run:

```sh
make validate
```

To remove generated export files, run:

```sh
make clean
```

Validation checks that the expected files exist, are not zero bytes, have readable PDF/DOCX/PPTX structure, meet the required page counts, and do not include internal metadata lines such as `Purpose:` or `Status:`.

The Markdown files in `dist/` are the source of truth. Files generated here are review copies and should be regenerated when the Markdown changes.
