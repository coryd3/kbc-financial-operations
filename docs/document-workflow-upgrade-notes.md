# Document Workflow Upgrade Notes

Status: Draft

## Purpose

This note captures lessons from the prior Kingsville Baptist Church Personnel Committee document repository that should inform this financial operations repository.

The goal is to keep what worked, avoid repeating fragile patterns, and build a cleaner workflow for drafting, review, approval, export, and release.

## Source Areas Reviewed

- `Kingsville Baptist Church/Personnel Committee/0_Admin & Reference/`
- `Kingsville Baptist Church/Personnel Committee/1_Job Descriptions/`
- `Kingsville Baptist Church/Personnel Committee/2_Evaluation & Accountability Frameworks/`
- `Kingsville Baptist Church/Personnel Committee/4_Committee Working Docs/Custodian Hiring 2026/`
- `Kingsville Baptist Church/Personnel Committee/5_Final Approved Documents (PDF only)/`
- `Kingsville Baptist Church/Personnel Committee/convert_gdocs.py`
- `Kingsville Baptist Church/Personnel Committee/GDOC_CONVERSION_CHECKLIST.md`

## Patterns Worth Keeping

### Standard Job Description Structure

The existing KBC job descriptions generally use this pattern:

- Kingsville Baptist Church.
- Role title.
- Revision date.
- Position Summary.
- Core Responsibilities.
- Accountability and Support.
- Character / lifestyle / work ethic expectations.
- Compensation and schedule, where applicable.
- Terms of Service.

The Bookkeeper / Financial Administrator job description has been reshaped to follow this pattern more closely.

### Clear Draft And Final Separation

The older repository separated working drafts from final approved PDFs. That is helpful and should continue in a modernized way:

- Markdown files should be the editable source of truth.
- Generated PDF, DOCX, and PPTX files should be review or release copies.
- Approved documents should be clearly marked as approved and bundled in dated releases.

### KBC Naming Convention

The older naming guide used:

`KBC_[Document_Title]_Rev_[MonthYear]`

This is still useful for final approved documents and formal release files. Working source files can remain shorter and easier to edit in Markdown.

### Hiring Process Toolkit

The Custodian hiring materials provide a good pattern for future hiring work:

- Hiring checklist.
- Candidate evaluation rubric.
- Interview guide.
- Reference check questionnaire.
- Hiring tracker.
- Role-specific checklists for hiring lead, interview coordinator, and reference checker.

The Bookkeeper hiring process document adapts this pattern for a financial role with stronger confidentiality, accuracy, and control expectations.

### Evaluation And Accountability Frameworks

The prior evaluation documents use a healthy tone: clarity, encouragement, accountability, support, and growth rather than punishment.

That tone should be kept if KBC creates a future Bookkeeper evaluation framework.

## Patterns To Improve

### Do Not Store Sensitive Hiring Records In This Repository

The older repository includes completed candidate applications and completed reference-check documents in working folders. Those should not be copied into this financial operations repository.

This repository should not store:

- Actual applications.
- Reference-check notes.
- Background-check results.
- Payroll documents.
- Social Security numbers.
- Bank account numbers.
- Donor records.
- Confidential personnel details.

### Replace One-Time Google Docs Conversion With Repeatable Export Workflow

The old `convert_gdocs.py` script was useful for a one-time conversion from Google Docs shortcuts to DOCX files. It should not be the main workflow going forward.

This repository should prefer:

- Markdown source files.
- Repeatable export scripts.
- GitHub Actions export artifacts.
- Dated release bundles.
- Clear validation checks.

### Avoid PDF-Only As The Only Final Source

The old final-approved folder is useful for sharing, but PDF-only final storage makes future updates harder.

Recommended pattern:

- Keep approved Markdown source.
- Generate approved PDF/DOCX as release copies.
- Store dated release bundles.
- Preserve superseded versions in `archive/` when needed.

### Normalize Encoding And Formatting

Some older converted Markdown files show encoding artifacts around dashes, arrows, and checkboxes. New Markdown should use plain ASCII where practical and avoid fragile special characters in templates.

### Make Workflow Easier For Non-Developers

The current Bash export workflow works well in GitHub Actions, but local Windows export is still too technical.

Future improvement:

- Add a Windows-friendly `scripts/export.ps1`.
- Add a simple `scripts/validate-exports.ps1`, if practical.
- Keep GitHub Actions as the no-install option for non-developers.

## Recommended Next Improvements

- Create a Bookkeeper evaluation framework after the job description and supervision path are settled.
- Create a formal Bookkeeper onboarding checklist after software and financial procedures are confirmed.
- Create a Windows-friendly export script for local use.
- Decide whether final approved release files should use KBC formal naming convention.
- Keep candidate-specific hiring materials outside this repository and store them only in the approved confidential Personnel Committee location.

## Current Changes Made From This Review

- Updated `docs/roles/bookkeeper-financial-administrator-job-description.md` to better match KBC job-description structure.
- Updated `templates/job-description-template.md` to reflect the stronger KBC format.
- Added `docs/roles/bookkeeper-hiring-process.md` based on the prior Custodian hiring process, adapted for a financial role.

Needs Committee Review: Personnel Committee should confirm whether this document workflow direction fits current church practice.
