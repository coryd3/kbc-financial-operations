# Agent Instructions

This repository contains the Kingsville Baptist Church financial operations handbook, current-work records, governance references, and operations portal. Work carefully and assume the repository may contain sensitive internal information.

The permanent goal is a clear, accountable, transferable, and sustainable church-owned operating system. The repository began during a Treasurer and Bookkeeper transition, but durable documents should not be written as though that temporary situation is the repository's permanent purpose.

## Repository Model

- **Handbook:** durable governing references, responsibilities, policies, procedures, charters, and role descriptions.
- **Current Workroom:** time-limited projects, committee packets, open questions, roadmaps, evaluations, tasks, and recommendations.
- **Church Record and History:** governing source material, recorded decisions, dated releases, and superseded versions. Official minutes remain with the Church Clerk or assigned records steward.
- **Operations Portal:** role-based workflows, recurring checklists, committee activity, decisions, feedback, and permitted financial operations.

Keep transition-specific dates, compensation limits, interim assignments, and hiring action items in project records. Keep handbook language general enough to remain useful when people and circumstances change.

## Historical 2026 Project Context

- KBC is a small, long-established Baptist church in Kingsville, Missouri.
- KBC uses congregational governance and must remain faithful to its bylaws.
- The repository began during a 2026 Treasurer and Bookkeeper transition.
- Interim Treasurer coverage maintained continuity while KBC reviewed the longer-term structure.
- The congregation authorized Personnel Committee to hire a paid Bookkeeper / Financial Administrator.
- The project identified a broader need for financial operations that do not depend too heavily on one person's knowledge or manual process.

Use this context in dated project records, decision history, and transition communications only. Do not use it as the organizing premise of permanent handbook pages.

Do not frame the transition as a person failure. Frame it as an opportunity to strengthen shared systems and stewardship.

Preferred framing:

> We are not trying to replace one person with another person. We are trying to build a financial system that is clear, accountable, transferable, and sustainable.

## Key Working Diagnosis

- The Treasurer role has become too broad.
- Governance and bookkeeping operations are mixed together.
- The Finance Committee needs clearer, more active ownership.
- KBC lacks written financial policies and procedures.
- Software may help, but software will not solve unclear governance.
- KBC needs documented systems that future volunteers or paid staff can follow.

## Governance Boundaries

Do not assume the Personnel Committee has authority to make Finance Committee decisions.

Personnel Committee should focus on:

- Defining roles and job descriptions.
- Hiring and recruiting process.
- Applications and interviews.
- Compensation recommendations.
- Evaluation process.

Finance Committee should focus on:

- Software selection.
- Spending authority.
- Reimbursement process.
- Budget impact.
- Credit/debit card policy.
- Financial controls.
- Monthly financial review.
- Audit/review process.

Other governance notes:

- The Nominating Committee may be involved in recommending elected officers as required by bylaws.
- The Congregation votes where required by bylaws or church policy.
- The Pastor and Deacons may provide leadership review, counsel, and communication support depending on the issue.
- Clearly mark recommendations that appear to require church approval, leadership review, or committee action.

## Safety Rules

- Do not add actual candidate applications, reference checks, background-check results, financial account credentials, member lists, donor records, payroll records, bank information, Social Security numbers, tax forms, or private personnel details.
- Do not publish or make the repository public without explicit user instruction.
- Preserve original source documents under `source-materials/`; draft new content in Markdown under `docs/`.
- When summarizing source materials, cite the source file path and avoid copying unnecessary personal details.
- Use `TBD` for unresolved facts, dollar amounts, dates, owners, and approval thresholds.
- Use clear review callouts such as `Needs Committee Review`, `Needs Finance Review`, `Needs Personnel Review`, `Needs Bylaw Review`, or `Needs Professional Review` where committee, professional, leadership, or church approval may be required.

## Writing Style

- Use plain, respectful church language.
- Avoid sounding corporate, harsh, accusatory, or overly bureaucratic.
- Use words like clarity, stewardship, accountability, support, sustainability, and order.
- Do not blame any current or former Treasurer, interim helper, committee, staff member, or volunteer.
- Separate governance decisions from procedures.
- Use "proposed" or "draft" labels until the church has formally approved a document.

## Permanent Reader-Facing Guardrails

- Orient readers to guidance, status, ownership, authority, and next steps. Do not make the homepage defend the project against a particular person's objection.
- Keep durable handbook pages platform-neutral. Named software, hosting, storage, and development platforms belong only in technical administration, deployment, export, or software-evaluation material where the name is necessary.
- Do not compare the handbook to a particular storage product as its primary value explanation.
- Keep dated transitions, vacancies, compensation limits, interim assignments, and hiring actions in the Current Workroom or decision history.
- Maintain one canonical current-work dashboard and one concise reader-orientation guide.
- Add links when they support the reader's current task. Avoid prominent links that pull a reader away before the page has provided enough context.

## Documentation Standards

- Use Markdown for active drafts.
- Use clear headings.
- Use tables when ownership, approvals, or decision paths are easier to understand visually.
- Keep document language calm, practical, and suitable for church committee review.
- Record open issues in `docs/03-open-questions.md`.
- Record final decisions in `docs/02-decision-log.md`.

## Finance Committee Review Round Trip

- Use `config/finance-review-documents.json` to control the documents included in a Finance Committee packet.
- Run `make finance-review` to generate one timestamped DOCX and PDF per selected document.
- Treat generated files and returned Word documents as review copies, never as the canonical source.
- Run `python scripts/ingest_finance_review.py <folder-or-zip>` to convert returned Word files into the ignored `review-intake/finance/` workspace.
- Read `review-summary.md`, the converted review, and the comparison before editing source Markdown.
- Apply only changes supported by the reviewer comments and the proper document owner or approval body.
- Preserve status and governance safeguards unless approval evidence supports changing them.
- Record adopted decisions and unresolved issues in their proper records, then rerun document and public-content audits.
- Never commit returned Word files or intake output without a specific privacy review; the folders are ignored intentionally.

See `docs/finance-committee-review-workflow.md` for the complete human and AI workflow.

## Document Status Labels

Use one of these near the top of active documents:

- `Status: Draft`
- `Status: Needs Committee Review`
- `Status: Needs Finance Review`
- `Status: Needs Personnel Review`
- `Status: Needs Bylaw Review`
- `Status: Needs Professional Review`
- `Status: Ready for Church Consideration`
- `Status: Approved`
- `Status: Superseded`
- `Status: Working Record`
- `Status: Current`
- `Status: Reference`
- `Status: Parking Lot`
