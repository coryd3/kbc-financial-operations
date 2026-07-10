import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import { DOCS_PAGES } from "@shared/docsNav";

/** Resolve a markdown link like "../policies/foo.md" against the current page slug. */
function resolveDocLink(href: string, currentSlug: string): string | null {
  const [rawPath, hash] = href.split("#");
  if (!rawPath.endsWith(".md")) return null;
  const baseDir = currentSlug.includes("/") ? currentSlug.slice(0, currentSlug.lastIndexOf("/")) : "";
  const parts = (baseDir ? baseDir.split("/") : []).concat(rawPath.split("/"));
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  const slug = resolved.join("/").replace(/\.md$/, "");
  if (!DOCS_PAGES.some((p) => p.slug === slug)) return null;
  return `/docs/${slug}${hash ? `#${hash}` : ""}`;
}

function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
        const { svg } = await mermaid.render(`mmd${id}`, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="bg-muted/50 border border-border rounded-md p-4 text-xs overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }
  return <div ref={ref} className="my-6 overflow-x-auto flex justify-center [&_svg]:max-w-full" />;
}

export function DocsMarkdown({ markdown, currentSlug }: { markdown: string; currentSlug: string }) {
  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-3xl font-bold text-primary mt-2 mb-4 pb-3 border-b border-border">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl font-semibold text-primary mt-10 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-xl font-semibold text-foreground mt-8 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h4>
          ),
          p: ({ children }) => <p className="leading-7 text-foreground/90 my-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-4 space-y-1.5 text-foreground/90">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-4 space-y-1.5 text-foreground/90">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent bg-accent/5 rounded-r-md px-4 py-2 my-5 text-foreground/85 [&_p]:my-2">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="text-left font-semibold px-3 py-2.5 border-b border-border align-top">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2.5 border-b border-border/60 align-top leading-6">{children}</td>
          ),
          code: (props) => {
            const { className, children } = props as { className?: string; children?: React.ReactNode };
            const language = /language-(\w+)/.exec(className || "")?.[1];
            const text = String(children ?? "").replace(/\n$/, "");
            const isBlock = Boolean(language) || text.includes("\n");
            if (language === "mermaid") return <MermaidDiagram code={text} />;
            if (isBlock) {
              return (
                <pre className="bg-muted/50 border border-border rounded-md p-4 text-xs overflow-x-auto my-5">
                  <code>{text}</code>
                </pre>
              );
            }
            return <code className="bg-muted px-1.5 py-0.5 rounded text-[0.85em] font-mono">{children}</code>;
          },
          a: ({ href, children }) => {
            const h = href ?? "";
            if (h.startsWith("#")) {
              return <a href={h} className="text-primary underline underline-offset-2 hover:text-accent">{children}</a>;
            }
            const internal = resolveDocLink(h, currentSlug);
            if (internal) {
              return (
                <Link href={internal} className="text-primary underline underline-offset-2 hover:text-accent">
                  {children}
                </Link>
              );
            }
            if (h.endsWith(".md")) {
              // Internal-style link to a page we don't serve — render as plain text.
              return <span>{children}</span>;
            }
            return (
              <a
                href={h}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-accent inline-flex items-center gap-1"
              >
                {children}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
