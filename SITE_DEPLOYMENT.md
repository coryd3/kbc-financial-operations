# Site Deployment Notes

Last updated: 2026-07-07

This file is for repository/site administration. It is not part of the church-facing documentation site navigation.

## Live Site

Published documentation site:

```text
https://coryd3.github.io/kbc-financial-operations/
```

GitHub repository:

```text
https://github.com/coryd3/kbc-financial-operations
```

## What The Site Is

The site is a searchable MkDocs/Material website built from the Markdown files in `docs/`.

The repository remains the source of truth. The website is a browser-friendly reading layer.

Because this repository has been published through GitHub Pages, treat both the repository and the live site as public unless privacy settings are intentionally changed and verified.

## How The Site Is Built

Local preview:

```powershell
python -m mkdocs serve
```

Local static build:

```powershell
python -m mkdocs build --strict
```

The static build is written to:

```text
site/
```

Each build also creates:

```text
site/open-local-site.bat
```

Double-click that file on Windows to browse the built site locally.

## GitHub Actions Workflows

### Build Docs Site

Workflow file:

```text
.github/workflows/build-docs-site.yml
```

Purpose:

- Builds the MkDocs site.
- Uploads the built `site/` folder as a GitHub Actions artifact.
- Does not publish the website.

This is useful for checking that the site builds cleanly.

### Deploy Docs Site To GitHub Pages

Workflow file:

```text
.github/workflows/deploy-docs-pages.yml
```

Purpose:

- Builds the MkDocs site.
- Uploads the built site to GitHub Pages.
- Publishes the live website.

This workflow is manual. To run it:

1. Go to the GitHub repository.
2. Open `Actions`.
3. Choose `Deploy Docs Site to GitHub Pages`.
4. Click `Run workflow`.
5. Type `DEPLOY` in the confirmation field.

GitHub Pages source should be set to `GitHub Actions` under repository `Settings` -> `Pages`.

The Makefile target `make docs-deploy` is guidance-only. It prints the GitHub Actions deployment instructions and does not run `mkdocs gh-deploy`.

## Publishing Reminder

Pushing to `main` updates the repository and triggers the build workflow, but the live GitHub Pages site is updated only when the deploy workflow runs.

After important content changes:

1. Push changes to `main`.
2. Confirm `Build Docs Site` passes.
3. Run `Deploy Docs Site to GitHub Pages` manually.
4. Visit the live URL and hard-refresh the browser.

## Analytics

Lightweight analytics are handled by GoatCounter.

GoatCounter site:

```text
https://kbc-financial-operations.goatcounter.com/
```

Tracking endpoint:

```text
https://kbc-financial-operations.goatcounter.com/count
```

Configuration file:

```text
docs/assets/javascripts/analytics-config.js
```

Current config:

```js
window.KBC_SITE_ANALYTICS = {
  provider: "goatcounter",
  goatcounterCode: "kbc-financial-operations",
  enabledHosts: ["coryd3.github.io"],
  trackLocal: false,
};
```

Meaning:

- Analytics run only on `coryd3.github.io`.
- Local previews at `localhost` or `127.0.0.1` are not tracked.
- The live site loads GoatCounter through `docs/assets/javascripts/site-analytics.js`.

To disable analytics, set:

```js
goatcounterCode: "",
```

then rebuild and redeploy the site.

## Privacy And Content Caution

The site and public repository should be treated as public.

Do not put donor records, payroll details, bank account numbers, passwords, Social Security numbers, candidate applications, background-check results, reference-check notes, confidential personnel issues, or private financial data in this repository or on the site.

Run this before publishing or broadly sharing updates:

```powershell
python scripts/audit_public_content.py
```

The audit checks tracked text files for obvious private-data or secret patterns and warns that binary files under `source-materials/` need manual review.

## Troubleshooting

If the site is not updated:

- Confirm the latest changes were pushed to `main`.
- Confirm `Deploy Docs Site to GitHub Pages` ran after the push.
- Hard-refresh the browser with `Ctrl+F5`.

If diagrams do not render:

- Confirm `mkdocs.yml` includes the Mermaid custom fence.
- Confirm `docs/assets/javascripts/diagram-viewer.js` is present.
- Run `python -m mkdocs build --strict`.

If analytics do not show visits:

- Confirm the deployed site includes `assets/javascripts/analytics-config.js`.
- Confirm `goatcounterCode` is set to `kbc-financial-operations`.
- Confirm the visit is on `https://coryd3.github.io/kbc-financial-operations/`, not local preview.
- Check whether a browser ad blocker is blocking GoatCounter.
