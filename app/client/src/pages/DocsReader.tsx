import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, Input } from "../components/ui";
import { DocsMarkdown } from "../components/DocsMarkdown";
import { cn } from "../lib/utils";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, FileText, Menu, Search, X } from "lucide-react";
import { useDebounce } from "../lib/useDebounce";
import { useAuth } from "../lib/auth";

function DocumentationFeedbackForm({ slug, revision }: { slug: string; revision: string }) {
  const { user } = useAuth();
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [category, setCategory] = useState<"unclear" | "inaccurate" | "outdated" | "suggestion" | "other">("suggestion");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.submitDocsFeedback({ pageSlug: slug, documentationRevision: revision, helpful: helpful!, category, comment }),
    onSuccess: () => setMessage("Thank you. Your feedback was sent privately to the review team."),
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <section className="mt-10 rounded-md border border-border bg-muted/30 p-4" aria-labelledby="docs-feedback-title">
      <h2 id="docs-feedback-title" className="text-base font-semibold text-foreground">Was this page helpful?</h2>
      {!user ? (
        <p className="mt-2 text-sm text-muted-foreground"><Link href="/login" className="text-primary underline">Sign in</Link> to submit private feedback.</p>
      ) : message ? (
        <p className="mt-2 text-sm" role="status">{message}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={helpful === true ? "default" : "outline"} onClick={() => setHelpful(true)}>Yes</Button>
            <Button type="button" size="sm" variant={helpful === false ? "default" : "outline"} onClick={() => setHelpful(false)}>No</Button>
          </div>
          {helpful !== null && (
            <>
              <label className="block text-sm font-medium">
                Feedback type
                <select className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
                  <option value="suggestion">Suggestion</option>
                  <option value="unclear">Unclear</option>
                  <option value="inaccurate">Inaccurate</option>
                  <option value="outdated">Outdated</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Comment (optional)
                <textarea className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2" maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} />
              </label>
              <p className="text-xs text-muted-foreground">Do not include donor, personnel, pastoral, banking, payroll, or other private information.</p>
              <Button type="button" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Sending..." : "Send feedback"}</Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function DocsReader() {
  const [location, setLocation] = useLocation();
  const slug = location.startsWith("/docs/")
    ? decodeURIComponent(location.slice("/docs/".length)).replace(/\/+$/, "")
    : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);

  const { data: navData } = useQuery({ queryKey: ["docsNav"], queryFn: api.getDocsNav, staleTime: Infinity });
  const docsNav = navData?.sections ?? [];
  const validSlugs = useMemo(() => new Set(docsNav.flatMap((section) => section.pages.map((page) => page.slug))), [docsNav]);

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
        docsNav.map((section) => (
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
            <DocsMarkdown markdown={page.markdown} currentSlug={page.slug} validSlugs={validSlugs} />
            <DocumentationFeedbackForm slug={page.slug} revision={page.revision} />
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
