import { isValidElement, useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Link } from "wouter";
import { Check, ExternalLink, Maximize2, MessageSquarePlus, X, ZoomIn, ZoomOut } from "lucide-react";

export type FeedbackSection = { id: string; title: string };

function plainText(children: React.ReactNode): string {
  if (Array.isArray(children)) return children.map(plainText).join("");
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (isValidElement(children)) return plainText((children.props as { children?: React.ReactNode }).children);
  return "";
}

function ReviewableHeading({
  level,
  id,
  children,
  className,
  onSectionFeedback,
  hasFeedback,
}: {
  level: 2 | 3 | 4;
  id?: string;
  children: React.ReactNode;
  className: string;
  onSectionFeedback?: (section: FeedbackSection) => void;
  hasFeedback: boolean;
}) {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  const title = plainText(children).trim();
  return (
    <div className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <Heading id={id} className={className}>{children}</Heading>
      {id && title && onSectionFeedback && (
        <button
          type="button"
          onClick={() => onSectionFeedback({ id, title })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`${hasFeedback ? "Review submitted feedback for" : "Comment on"} ${title}`}
        >
          {hasFeedback ? <Check className="h-3.5 w-3.5" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
          {hasFeedback ? "Feedback sent" : "Comment"}
        </button>
      )}
    </div>
  );
}

/** Resolve a markdown link like "../policies/foo.md" against the current page slug. */
function resolveDocLink(href: string, currentSlug: string, validSlugs: Set<string>): string | null {
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
  if (!validSlugs.has(slug)) return null;
  return `/docs/${slug}${hash ? `#${hash}` : ""}`;
}

function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [svg, setSvg] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const rendered = await mermaid.render(`mmd${id}`, code);
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = svg;
  }, [svg]);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);

  if (error) {
    return (
      <pre className="bg-muted/50 border border-border rounded-md p-4 text-xs overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group relative my-6 block w-full overflow-x-auto rounded-md border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Enlarge diagram"
      >
        <span ref={ref} className="flex justify-center [&_svg]:max-w-full" />
        <span className="absolute right-2 top-2 rounded bg-background/95 p-1.5 text-primary shadow-sm opacity-80 group-hover:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged diagram"
          className="fixed inset-0 z-50 flex flex-col bg-background/95 p-3 sm:p-6"
        >
          <div className="mb-3 flex justify-end gap-2">
            <button className="rounded border p-2" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out">
              <ZoomOut className="h-5 w-5" />
            </button>
            <button className="rounded border p-2" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in">
              <ZoomIn className="h-5 w-5" />
            </button>
            <button className="rounded border p-2" onClick={() => setExpanded(false)} aria-label="Close diagram">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-md border bg-white p-6">
            <div
              className="mx-auto min-w-max origin-top-left [&_svg]:max-w-none"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function DocsMarkdown({
  markdown,
  currentSlug,
  validSlugs,
  onSectionFeedback,
  feedbackSectionIds = new Set<string>(),
}: {
  markdown: string;
  currentSlug: string;
  validSlugs: Set<string>;
  onSectionFeedback?: (section: FeedbackSection) => void;
  feedbackSectionIds?: Set<string>;
}) {
  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 {...props} className="font-serif text-3xl font-bold text-primary mt-2 mb-4 pb-3 border-b border-border">{children}</h1>
          ),
          h2: ({ children, node: _node, ...props }) => (
            <ReviewableHeading level={2} id={props.id} className="font-serif text-2xl font-semibold text-primary mt-10 mb-3" onSectionFeedback={onSectionFeedback} hasFeedback={feedbackSectionIds.has(props.id ?? "")}>{children}</ReviewableHeading>
          ),
          h3: ({ children, node: _node, ...props }) => (
            <ReviewableHeading level={3} id={props.id} className="font-serif text-xl font-semibold text-foreground mt-8 mb-2" onSectionFeedback={onSectionFeedback} hasFeedback={feedbackSectionIds.has(props.id ?? "")}>{children}</ReviewableHeading>
          ),
          h4: ({ children, node: _node, ...props }) => (
            <ReviewableHeading level={4} id={props.id} className="text-base font-semibold text-foreground mt-6 mb-2" onSectionFeedback={onSectionFeedback} hasFeedback={feedbackSectionIds.has(props.id ?? "")}>{children}</ReviewableHeading>
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
            const internal = resolveDocLink(h, currentSlug, validSlugs);
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
