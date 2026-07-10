import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Input } from "../components/ui";
import { BookText, Search, FileText, ChevronRight, MessageSquareText } from "lucide-react";
import { useDebounce } from "../lib/useDebounce";
import { useAuth } from "../lib/auth";

export default function Docs() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const { data: navData } = useQuery({ queryKey: ["docsNav"], queryFn: api.getDocsNav, staleTime: Infinity });
  const docsNav = navData?.sections ?? [];

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["docsSearch", debounced],
    queryFn: () => api.searchDocs(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const searching = debounced.trim().length >= 2;
  const results = searchData?.results ?? [];

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-serif text-primary font-bold">Documentation Hub</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Church policies, procedures, committee charters, and operation guides — all readable
          and searchable right here.
        </p>
        {user && (
          <Link href="/docs/my-feedback" className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted/50">
            <MessageSquareText className="h-4 w-4" /> Review my feedback
          </Link>
        )}
        <div className="relative max-w-xl mt-5">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search all documentation…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) {
                setLocation(`/docs/${results[0].slug}`);
              }
            }}
          />
        </div>
      </div>

      {searching ? (
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm text-muted-foreground">
            {isFetching ? "Searching…" : `${results.length} page${results.length === 1 ? "" : "s"} found`}
          </p>
          {results.map((r) => (
            <Link
              key={r.slug}
              href={`/docs/${r.slug}`}
              className="block border border-border rounded-md p-4 hover:border-primary/40 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="w-3.5 h-3.5" />
                {r.section}
              </div>
              <div className="font-medium text-primary">{r.title}</div>
              {r.snippets.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.snippets.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground truncate">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
          {!isFetching && results.length === 0 && (
            <p className="text-muted-foreground py-6">No pages match “{debounced}”.</p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {docsNav.map((section) => (
            <Card key={section.title} className="flex flex-col h-full hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <BookText className="w-5 h-5" />
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <ul className="space-y-1.5 border-t border-border pt-4">
                  {section.pages.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/docs/${p.slug}`}
                        className="text-sm text-foreground/80 hover:text-accent flex items-center gap-1.5 transition-colors group"
                      >
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 shrink-0" />
                        {p.title}
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
