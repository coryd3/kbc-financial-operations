# Release Bundles

This folder is for dated release bundles created by:

```sh
make release
```

Each release is copied from generated files in `dist/exports/` into a dated folder such as `dist/releases/YYYY-MM-DD/`, then zipped as `dist/releases/YYYY-MM-DD.zip`.

Release folders and zip files are generated outputs. The Markdown files in `dist/` remain the source of truth.
