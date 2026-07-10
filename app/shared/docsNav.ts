export interface DocsPageRef {
  slug: string;
  file: string;
  title: string;
}

export interface DocsSection {
  title: string;
  pages: DocsPageRef[];
}
