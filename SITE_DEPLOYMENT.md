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

## Operations Portal Production Hosting

The authenticated operations portal under `app/` is separate from the public MkDocs site. The recommended production host is Render:

- Starter Node web service: approximately $7 per month.
- Basic PostgreSQL database: approximately $6 per month, plus 1 GB of initial storage at approximately $0.30 per month.
- Expected starting total: approximately $13.30 per month.
- Working budget: $15 per month; investigate sustained costs above $20.

Current pricing can change. Confirm the plans shown by Render before creating paid resources.

The root `render.yaml` is the production blueprint. It creates one web service and one private PostgreSQL database with 1 GB of initial storage, waits for GitHub checks, runs checked-in migrations before deployment, and checks `/api/health`.

Render sets `NODE_ENV=production`, but the build still needs Vite, TypeScript, and other development dependencies. The Blueprint therefore runs `npm ci --include=dev` during the build. These tools compile the production bundle; the deployed server still runs in production mode. GitHub Actions separately audits production dependencies before deployment.

### First Render Setup

1. Merge a tested branch into `main` on GitHub.
2. In Render, choose **New > Blueprint** and connect `coryd3/kbc-financial-operations`.
3. Review the resources described by `render.yaml` before accepting charges.
4. Confirm `SESSION_SECRET` and `MFA_ENCRYPTION_KEY` were generated as secret values.
5. Let the first build and pre-deploy migration finish.
6. Open a Render Shell for the web service and create the first administrator with temporary environment variables:

```sh
BOOTSTRAP_ADMIN_USERNAME=kbcadmin \
BOOTSTRAP_ADMIN_PASSWORD='use-a-unique-12-character-or-longer-temporary-password' \
BOOTSTRAP_ADMIN_FULL_NAME='System Administrator' \
BOOTSTRAP_ADMIN_EMAIL='administrator@example.org' \
npm run db:bootstrap-admin
```

Do not place the bootstrap password in GitHub, documentation, chat, or source files. Remove temporary environment values after the command. The administrator must change the password and enroll MFA on first sign-in.

Do not run `db:seed:baseline` in production. Production begins with a clean database and church-approved users and records.

### Required Production Settings

- `DATABASE_URL`: supplied through Render's private database connection.
- `SESSION_SECRET`: generated secret, never committed.
- `MFA_ENCRYPTION_KEY`: generated secret, never committed.
- `FINANCIAL_MODE=hybrid`.
- `VITE_FINANCIAL_MODE=hybrid`.
- `NODE_ENV=production`.

### Account Email And Verification

The portal uses Resend for transactional account email. Its free transactional tier is sufficient for the expected KBC account volume, but current limits should be confirmed with the provider before launch.

Create a Resend account, verify a sending domain or approved sender, and add these values under the Render web service's **Environment** settings:

- `RESEND_API_KEY`: secret API key; never commit it.
- `EMAIL_FROM`: verified sender, such as `KBC Operations Portal <portal@church-domain.example>`.
- `APP_BASE_URL`: the public portal URL with no trailing slash.
- `OPERATIONS_ALERT_EMAILS`: optional comma-separated fallback recipients for registration and operational notices.

Active users assigned the `Admin` or `Super Admin` role and having an email address also receive new-registration notices. Registrants receive an email-verification link, and approval sends an access-granted email directly to the registered address.

#### Temporary Approval-Only Onboarding

Until a church-controlled sending domain can be verified, production may use:

```text
REQUIRE_EMAIL_VERIFICATION=false
```

In this temporary mode:

- Registration remains open.
- Every registration starts as a pending `Member` with no committee, directory, financial, or administrative access.
- A portal administrator must still review and approve the account.
- After approval, the person may sign in without completing an email-verification link.
- The portal clearly labels the email as unverified and records that verification was not required; it does not falsely mark the address as verified.
- Account and operational email notifications remain unavailable until Resend is configured.

This is the current Render Blueprint setting. After the church sending domain and Resend API key are configured and tested, change `REQUIRE_EMAIL_VERIFICATION` to `true`. The secure code default is `true` when the variable is absent.

If `RESEND_API_KEY` or `EMAIL_FROM` is missing, registration still succeeds safely, but the portal reports that email delivery is unavailable. Pending users can sign in only to the account-setup page and receive no member, committee, directory, checklist, or financial permissions.

Existing active accounts were treated as verified when the email-verification migration was first applied so current users were not unexpectedly locked out. When `REQUIRE_EMAIL_VERIFICATION=true`, pending accounts and new registrations must verify their email; when it is `false`, administrator approval is sufficient for Member access.

Technical administrators do not receive donor or finance access automatically. Treasurer and Bookkeeper access must be assigned intentionally. Privileged roles require MFA.

### Normal Deployment

1. Develop locally or in Replit on a feature branch.
2. Push the branch and open a pull request.
3. Merge only after `App CI` and documentation checks pass.
4. Render sees the successful checks on `main`, builds the application, runs migrations, and deploys it.
5. Verify `/api/health`, login, MFA, documentation, feedback, giving, and audit behavior.

If a build or migration fails, Render keeps the prior successful deployment active. Use a temporary preview environment for risky schema migrations, then remove it after verification to control cost.

### Database Backups

- Keep the paid Render database so managed point-in-time recovery is available under the selected plan.
- Create an on-demand logical export before significant migrations.
- Download a logical backup monthly to a restricted church-controlled location outside this repository.
- Perform a restore rehearsal before entering real donor data and at least annually afterward.
- Never commit a database dump, donor export, payroll record, or backup archive.

### Replit and Local Development

Replit is optional development tooling only. It is not the production database or deployment authority. Do not copy Replit sample users or test data into production.

For local application work, use a separate development PostgreSQL database, then run:

```sh
cd app
npm ci
npm run build
npm run db:migrate
npm run dev
```

Keep development, test, and production database URLs separate.
