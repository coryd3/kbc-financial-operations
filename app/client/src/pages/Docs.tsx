import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookText, ChevronRight, FileText, MessageSquareText, Search } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  DOCUMENTATION_VIEW_LABELS,
  pageMatchesView,
  useDocumentationView,
  type DocumentationView,
} from "../lib/docsAudience";
import { useDebounce } from "../lib/useDebounce";
import { Card, CardContent, CardHeader, CardTitle, Input } from "../components/ui";

export default function Docs() {
  const { user, portalAccess } = useAuth();
  const { view, setView } = useDocumentationView(user);
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const { data: navData } = useQuery({ queryKey: ["docsNav"], queryFn: api.getDocsNav, staleTime: Infinity });
  const docsNav = (navData?.sections ?? [])
    .map((section) => ({
      ...section,
      pages: section.pages.filter((page) => pageMatchesView(page.metadata.audiences, view)),
    }))
    .filter((section) => section.pages.length > 0);

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["docsSearch", debounced, view],
    queryFn: () => api.searchDocs(debounced, view),
    enabled: debounced.trim().length >= 2,
  });
  const searching = debounced.trim().length >= 2;
  const results = searchData?.results ?? [];

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-serif text-primary font-bold">Documentation Hub</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Browse church references, governance, policies, procedures, and active committee work without having to sort through every project file.
        </p>
        {portalAccess && (
          <Link href="/docs/my-feedback" className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted/50">
            <MessageSquareText className="h-4 w-4" /> Review my feedback
          </Link>
        )}
        <div className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search this documentation view..."
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results.length > 0) setLocation(`/docs/${results[0].slug}`);
              }}
            />
          </div>
          <label className="sr-only" htmlFor="documentation-view">Documentation view</label>
          <select
            id="documentation-view"
            value={view}
            onChange={(event) => setView(event.target.value as DocumentationView)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(DOCUMENTATION_VIEW_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {DOCUMENTATION_VIEW_LABELS[view]}. This changes what is emphasized, not what public information may be accessed.
        </p>
      </div>

      {searching ? (
        <div className="max-w-3xl space-y-3">
          <p className="text-sm text-muted-foreground">
            {isFetching ? "Searching..." : `${results.length} page${results.length === 1 ? "" : "s"} found`}
          </p>
          {results.map((result) => (
            <Link key={result.slug} href={`/docs/${result.slug}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/20">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {result.section}
              </div>
              <div className="font-medium text-primary">{result.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{result.metadata.documentType} / {result.metadata.status}</div>
              {result.snippets.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.snippets.map((snippet, index) => <li key={index} className="truncate text-sm text-muted-foreground">{snippet}</li>)}
                </ul>
              )}
            </Link>
          ))}
          {!isFetching && results.length === 0 && <p className="py-6 text-muted-foreground">No pages match "{debounced}".</p>}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {docsNav.map((section) => (
            <Card key={section.title} className="flex h-full flex-col transition-colors hover:border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <BookText className="h-5 w-5" />
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <ul className="space-y-2 border-t border-border pt-4">
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <Link href={`/docs/${page.slug}`} className="group flex items-start gap-1.5 text-sm text-foreground/80 transition-colors hover:text-accent">
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
                        <span>
                          <span className="block">{page.title}</span>
                          <span className="block text-xs text-muted-foreground">{page.metadata.documentType}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
