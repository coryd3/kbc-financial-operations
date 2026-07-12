import { useEffect, useState } from "react";
import type { DocumentationAudience } from "@shared/docsNav";
import type { SafeUser } from "@shared/schema";

export type DocumentationView = DocumentationAudience | "all";

export const DOCUMENTATION_VIEW_LABELS: Record<DocumentationView, string> = {
  congregation: "Church Member Library",
  leadership: "Leadership View",
  treasurer: "Treasurer / Finance Chair View",
  finance: "Finance Committee View",
  personnel: "Personnel Committee View",
  operations: "Financial Operations View",
  project: "Current Workroom",
  all: "All Documents",
};

export const DOCUMENTATION_VIEW_DESCRIPTIONS: Record<DocumentationView, string> = {
  congregation: "Governing references, approved guidance, responsibilities, and updates relevant to the whole church.",
  leadership: "Current decisions, governance questions, committee recommendations, and leadership planning.",
  treasurer: "A focused starting set for Treasurer accountability, Finance Committee leadership, recurring review, and current financial decisions.",
  finance: "Committee oversight: policy, budget review, spending controls, software decisions, and review of financial reports.",
  personnel: "Role descriptions, hiring materials, supervision questions, and Personnel Committee review work.",
  operations: "Hands-on work: contributions, deposits, reimbursements, payroll steps, reconciliations, monthly close, and reporting.",
  project: "Draft packets, issue registers, evaluations, implementation notes, and other active project material.",
  all: "Every public handbook and workroom document. Best for research, but usually more information than a routine reader needs.",
};

const STORAGE_KEY = "kbc-documentation-view";

function recommendedView(user: SafeUser | null): DocumentationView {
  const roles = user?.roles ?? (user ? [user.role] : []);
  if (roles.includes("treasurer")) return "treasurer";
  if (roles.includes("finance_committee")) return "finance";
  if (roles.includes("bookkeeper") || roles.includes("counting_team")) return "operations";
  if (roles.includes("personnel_committee")) return "personnel";
  if (roles.some((role) => role === "deacon" || role === "admin" || role === "super_admin")) return "leadership";
  return "congregation";
}

function storedView(): DocumentationView | null {
  const value = window.localStorage.getItem(STORAGE_KEY) as DocumentationView | null;
  return value && value in DOCUMENTATION_VIEW_LABELS ? value : null;
}

function requestedView(): DocumentationView | null {
  const value = new URLSearchParams(window.location.search).get("view") as DocumentationView | null;
  return value && value in DOCUMENTATION_VIEW_LABELS ? value : null;
}

export function useDocumentationView(user: SafeUser | null) {
  const [view, setViewState] = useState<DocumentationView>(() => requestedView() ?? storedView() ?? recommendedView(user));
  useEffect(() => {
    const requested = requestedView();
    if (requested) {
      window.localStorage.setItem(STORAGE_KEY, requested);
      setViewState(requested);
    } else if (!storedView()) {
      setViewState(recommendedView(user));
    }
  }, [user]);
  const setView = (next: DocumentationView) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setViewState(next);
  };
  return { view, setView };
}

export function pageMatchesView(audiences: DocumentationAudience[], view: DocumentationView): boolean {
  return view === "all" || audiences.includes(view);
}
