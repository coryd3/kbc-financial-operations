import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, Input } from "../components/ui";
import { DOCS_NAV } from "@shared/docsNav";
import { DocsMarkdown } from "../components/DocsMarkdown";
import { cn } from "../lib/utils";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, FileText, Menu, Search, X } from "lucide-react";
import { useDebounce } from "../lib/useDebounce";

export default function DocsReader() {
  const [location, setLocation] = useLocation();
  const slug = location.startsWith("/docs/")
    ? decodeURIComponent(location.slice("/docs/".length)).replace(/\/+$/, "")
    : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["docsPage", slug],
    queryFn: () => api.getDocsPage(slug),
    enabled: !!slug,
  });

  const { data: searchData, isFetching: searchLoading } = useQuery({
    queryKey: ["docsSearch", debounced],
    queryFn: () => api.searchDocs(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const searching = debounced.trim().length >= 2;
  const results = searchData?.results ?? [];

  const sidebar = (
    <nav className="space-y-6">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search docs…"
          className="pl-9 h-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {searching ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground px-1 pb-1">
            {searchLoading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
          </p>
          {results.map((r) => (
            <Link
              key={r.slug}
              href={`/docs/${r.slug}`}
              onClick={() => {
                setQuery("");
                setMenuOpen(false);
              }}
              className="block px-2 py-1.5 rounded text-sm hover:bg-muted/60 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {r.title}
              </span>
              {r.snippets[0] && (
                <span className="block text-xs text-muted-foreground truncate pl-5">{r.snippets[0]}</span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        DOCS_NAV.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {section.title}
            </h3>
            <ul className="space-y-0.5">
              {section.pages.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/docs/${p.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "block px-2 py-1.5 rounded text-sm transition-colors leading-snug",
                      p.slug === slug
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </nav>
  );

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100dvh-4rem)] overflow-y-auto pr-2 pb-8">
          <Link
            href="/docs"
            className="flex items-center gap-2 text-sm font-medium text-primary mb-5 hover:text-accent transition-colors"
          >
            <BookOpen className="w-4 h-4" /> Documentation Hub
          </Link>
          {sidebar}
        </div>
      </aside>

      {/* Mobile controls */}
      <div className="lg:hidden mb-4 flex items-center justify-between gap-3">
        <Link href="/docs" className="flex items-center gap-1.5 text-sm text-primary font-medium">
          <ChevronLeft className="w-4 h-4" /> All docs
        </Link>
        <Button variant="outline" size="sm" onClick={() => setMenuOpen((o) => !o)}>
          <Menu className="w-4 h-4 mr-1.5" /> {menuOpen ? "Hide contents" : "Contents"}
        </Button>
      </div>
      {menuOpen && (
        <div className="lg:hidden mb-6 border border-border rounded-md p-4 bg-background">{sidebar}</div>
      )}

      {/* Content */}
      <article className="min-w-0 max-w-3xl">
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading…</div>
        ) : error || !page ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-lg font-medium">Page not found</p>
            <p className="text-muted-foreground text-sm">This documentation page doesn't exist.</p>
            <Button variant="outline" onClick={() => setLocation("/docs")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Documentation Hub
            </Button>
          </div>
        ) : (
          <>
            {page.section && (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {page.section}
              </p>
            )}
            <DocsMarkdown markdown={page.markdown} currentSlug={page.slug} />
            <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-3">
              {page.prev ? (
                <Link
                  href={`/docs/${page.prev.slug}`}
                  className="group flex items-center gap-2 text-sm text-foreground/75 hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                  <span>
                    <span className="block text-xs text-muted-foreground">Previous</span>
                    {page.prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {page.next && (
                <Link
                  href={`/docs/${page.next.slug}`}
                  className="group flex items-center gap-2 text-sm text-foreground/75 hover:text-primary transition-colors sm:text-right sm:ml-auto"
                >
                  <span>
                    <span className="block text-xs text-muted-foreground">Next</span>
                    {page.next.title}
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                </Link>
              )}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
