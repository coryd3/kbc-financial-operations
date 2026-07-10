import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { api, type DocumentationFeedback } from "../lib/api";

const statusLabels: Record<DocumentationFeedback["status"], string> = {
  new: "New",
  reviewed: "Reviewed",
  accepted: "Accepted",
  planned: "Planned",
  resolved: "Resolved",
  declined: "Declined",
};

export default function MyDocsFeedback() {
  const { data, isLoading } = useQuery({
    queryKey: ["myDocsFeedback"],
    queryFn: api.getMyDocsFeedback,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2 text-primary">
          <MessageSquareText className="h-6 w-6" />
          <h1 className="text-3xl font-serif font-bold">My Documentation Feedback</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Review your private comments, their governance status, and the document sections they refer to.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">Loading feedback...</p>
      ) : data?.feedback.length ? (
        <div className="divide-y divide-border rounded-md border border-border bg-background">
          {data.feedback.map((item) => {
            const anchor = item.sectionId ? `#${item.sectionId}` : "";
            return (
              <article key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{item.pageTitle}</p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">
                      {item.sectionTitle || "Whole-page feedback"}
                    </h2>
                  </div>
                  <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold">
                    {statusLabels[item.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.category} / submitted {new Date(item.createdAt).toLocaleDateString()} / revision {item.documentationRevision}
                </p>
                {item.comment && <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-6">{item.comment}</p>}
                <Link href={`/docs/${item.pageSlug}${anchor}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  Open referenced section <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">You have not submitted documentation feedback yet.</p>
          <Link href="/docs" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Browse documentation</Link>
        </div>
      )}
    </div>
  );
}
