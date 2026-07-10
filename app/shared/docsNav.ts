// In-app documentation navigation, mirroring the structure of the original
// MkDocs site (mkdocs.yml nav). Each page's `slug` is its URL under /docs/…
// and `file` is the markdown file path relative to the repo's docs/ folder.

export interface DocsPageRef {
  slug: string;
  file: string;
  title: string;
}

export interface DocsSection {
  title: string;
  pages: DocsPageRef[];
}

function page(file: string, title: string): DocsPageRef {
  return { slug: file.replace(/\.md$/, ""), file, title };
}

export const DOCS_NAV: DocsSection[] = [
  {
    title: "Start Here",
    pages: [
      page("index.md", "Home"),
      page("start-here/project-dashboard.md", "Leader-Friendly Dashboard"),
      page("00-project-brief.md", "Project Brief"),
      page("01-current-state-assessment.md", "Current State Assessment"),
      page("project-dashboard.md", "Project Dashboard"),
      page("document-inventory.md", "Document Inventory"),
    ],
  },
  {
    title: "Leadership Review",
    pages: [
      page("leadership-review/index.md", "Overview"),
      page("communications/leadership-review-packet.md", "Leadership Review Packet"),
      page("implementation-roadmap.md", "Implementation Roadmap"),
      page("02-decision-log.md", "Decision Log"),
      page("03-open-questions.md", "Open Questions"),
    ],
  },
  {
    title: "Governance and Responsibility",
    pages: [
      page("governance/constitution-and-bylaws-reference.md", "Constitution and Bylaws Reference"),
      page("governance/church-organization-chart.md", "Church Organization Chart"),
      page("governance/responsibility-matrix.md", "Responsibility Matrix"),
      page("governance/finance-committee-charter.md", "Finance Committee Charter"),
      page("governance/personnel-committee-role.md", "Personnel Committee Role"),
    ],
  },
  {
    title: "Roles and Hiring",
    pages: [
      page("roles/treasurer-vs-bookkeeper-duty-split.md", "Treasurer vs. Bookkeeper Duty Split"),
      page("roles/treasurer-governance-role.md", "Treasurer Governance Role"),
      page("roles/interim-treasurer-role.md", "Interim Treasurer Role"),
      page("roles/bookkeeper-financial-administrator-job-description.md", "Bookkeeper Job Description"),
      page("roles/bookkeeper-job-application.md", "Bookkeeper Application"),
      page("roles/bookkeeper-hiring-process.md", "Bookkeeper Hiring Process"),
      page("roles/job-description-consistency-check.md", "Job Description Consistency Check"),
    ],
  },
  {
    title: "Finance Operations",
    pages: [
      page("policies/reimbursement-policy.md", "Reimbursement Policy"),
      page("procedures/reimbursement-process.md", "Reimbursement Process"),
      page("policies/spending-authority-policy.md", "Spending Authority Policy"),
      page("policies/credit-card-policy.md", "Credit Card Policy"),
      page("policies/monthly-financial-review-policy.md", "Monthly Financial Review Policy"),
      page("procedures/monthly-finance-committee-meeting-checklist.md", "Monthly Finance Committee Checklist"),
      page("policies/offering-counting-and-deposit-policy.md", "Offering Counting and Deposit Policy"),
      page("procedures/contribution-entry-process.md", "Contribution Entry Process"),
      page("procedures/weekly-bookkeeping-checklist.md", "Weekly Bookkeeping Checklist"),
      page("procedures/monthly-close-checklist.md", "Monthly Close Checklist"),
      page("procedures/business-meeting-report-process.md", "Business Meeting Report Process"),
      page("procedures/payroll-process.md", "Payroll Process"),
      page("policies/audit-and-review-policy.md", "Audit and Review Policy"),
    ],
  },
  {
    title: "Software Evaluation",
    pages: [
      page("software-evaluation/software-requirements.md", "Software Requirements"),
      page("software-evaluation/demo-scorecard.md", "Demo Scorecard"),
      page("software-evaluation/icon-vs-churchtrac-comparison.md", "IconCMO vs. ChurchTrac Comparison"),
      page("software-evaluation/implementation-plan.md", "Implementation Plan"),
    ],
  },
  {
    title: "Communications",
    pages: [
      page("communications/personnel-committee-packet.md", "Personnel Committee Packet"),
      page("communications/finance-committee-packet.md", "Finance Committee Packet"),
      page("communications/personnel-committee-recommendation.md", "Personnel Committee Recommendation"),
      page("communications/finance-committee-recommendation.md", "Finance Committee Recommendation"),
      page("communications/deacon-update.md", "Deacon Update"),
      page("communications/church-business-meeting-summary.md", "Church Business Meeting Summary"),
      page("communications/one-page-congregational-summary.md", "One-Page Congregational Summary"),
      page("communications/congregational-slide-outline.md", "Congregational Slide Outline"),
    ],
  },
  {
    title: "Exports and Releases",
    pages: [
      page("export-process.md", "Export Process"),
      page("exports-and-releases.md", "Exported Files and Release Bundles"),
      page("document-workflow-upgrade-notes.md", "Document Workflow Notes"),
    ],
  },
];

export const DOCS_PAGES: DocsPageRef[] = DOCS_NAV.flatMap((s) => s.pages);

export function findDocsPage(slug: string): DocsPageRef | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

export function docsSectionFor(slug: string): DocsSection | undefined {
  return DOCS_NAV.find((s) => s.pages.some((p) => p.slug === slug));
}
