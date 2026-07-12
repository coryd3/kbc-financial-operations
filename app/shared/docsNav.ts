export const DOCUMENTATION_AUDIENCES = [
  "congregation",
  "leadership",
  "treasurer",
  "finance",
  "personnel",
  "operations",
  "project",
] as const;

export type DocumentationAudience = (typeof DOCUMENTATION_AUDIENCES)[number];

export interface DocsMetadata {
  documentType: string;
  status: string;
  owner: string;
  lifecycle: "durable" | "project" | "communication" | "administration" | "reference";
  audiences: DocumentationAudience[];
}

export interface DocsPageRef {
  slug: string;
  file: string;
  title: string;
  metadata: DocsMetadata;
}

export interface DocsSection {
  title: string;
  pages: DocsPageRef[];
}
