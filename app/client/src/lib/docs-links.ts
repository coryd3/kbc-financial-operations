export const DOCS_BASE_URL = "https://coryd3.github.io/kbc-financial-operations";

export interface DocsTopic {
  title: string;
  description: string;
  links: { label: string; path: string }[];
}

export const DOCS_TOPICS: DocsTopic[] = [
  {
    title: "Start Here",
    description: "Project overview, dashboards, and current status.",
    links: [
      { label: "Documentation Home", path: "/" },
      { label: "Leader-Friendly Dashboard", path: "/start-here/project-dashboard/" },
      { label: "Project Brief", path: "/00-project-brief/" },
      { label: "Current State Assessment", path: "/01-current-state-assessment/" },
      { label: "Project Dashboard", path: "/project-dashboard/" },
    ],
  },
  {
    title: "Leadership Review",
    description: "Materials for pastor, deacons, and committee leadership review.",
    links: [
      { label: "Leadership Review Overview", path: "/leadership-review/" },
      { label: "Leadership Review Packet", path: "/communications/leadership-review-packet/" },
      { label: "Implementation Roadmap", path: "/implementation-roadmap/" },
      { label: "Decision Log", path: "/02-decision-log/" },
      { label: "Open Questions", path: "/03-open-questions/" },
    ],
  },
  {
    title: "Governance & Responsibility",
    description: "Constitution, bylaws, org chart, and committee charters.",
    links: [
      { label: "Constitution & Bylaws Reference", path: "/governance/constitution-and-bylaws-reference/" },
      { label: "Church Organization Chart", path: "/governance/church-organization-chart/" },
      { label: "Responsibility Matrix", path: "/governance/responsibility-matrix/" },
      { label: "Finance Committee Charter", path: "/governance/finance-committee-charter/" },
      { label: "Personnel Committee Role", path: "/governance/personnel-committee-role/" },
    ],
  },
  {
    title: "Roles & Hiring",
    description: "Treasurer and Bookkeeper roles, job descriptions, and hiring process.",
    links: [
      { label: "Treasurer vs. Bookkeeper Duty Split", path: "/roles/treasurer-vs-bookkeeper-duty-split/" },
      { label: "Treasurer Governance Role", path: "/roles/treasurer-governance-role/" },
      { label: "Interim Treasurer Role", path: "/roles/interim-treasurer-role/" },
      { label: "Bookkeeper Job Description", path: "/roles/bookkeeper-financial-administrator-job-description/" },
      { label: "Bookkeeper Hiring Process", path: "/roles/bookkeeper-hiring-process/" },
    ],
  },
  {
    title: "Finance Policies & Procedures",
    description: "Money handling policies, checklists, and step-by-step procedures.",
    links: [
      { label: "Reimbursement Policy", path: "/policies/reimbursement-policy/" },
      { label: "Spending Authority Policy", path: "/policies/spending-authority-policy/" },
      { label: "Credit Card Policy", path: "/policies/credit-card-policy/" },
      { label: "Monthly Financial Review Policy", path: "/policies/monthly-financial-review-policy/" },
      { label: "Offering Counting & Deposit Policy", path: "/policies/offering-counting-and-deposit-policy/" },
      { label: "Weekly Bookkeeping Checklist", path: "/procedures/weekly-bookkeeping-checklist/" },
      { label: "Monthly Close Checklist", path: "/procedures/monthly-close-checklist/" },
      { label: "Payroll Process", path: "/procedures/payroll-process/" },
      { label: "Audit and Review Policy", path: "/policies/audit-and-review-policy/" },
    ],
  },
  {
    title: "Software Evaluation",
    description: "Church management software requirements and comparisons.",
    links: [
      { label: "Software Requirements", path: "/software-evaluation/software-requirements/" },
      { label: "Demo Scorecard", path: "/software-evaluation/demo-scorecard/" },
      { label: "IconCMO vs. ChurchTrac Comparison", path: "/software-evaluation/icon-vs-churchtrac-comparison/" },
      { label: "Implementation Plan", path: "/software-evaluation/implementation-plan/" },
    ],
  },
  {
    title: "Communications",
    description: "Committee packets, recommendations, and congregational updates.",
    links: [
      { label: "Personnel Committee Packet", path: "/communications/personnel-committee-packet/" },
      { label: "Finance Committee Packet", path: "/communications/finance-committee-packet/" },
      { label: "Deacon Update", path: "/communications/deacon-update/" },
      { label: "Church Business Meeting Summary", path: "/communications/church-business-meeting-summary/" },
      { label: "One-Page Congregational Summary", path: "/communications/one-page-congregational-summary/" },
    ],
  },
];
