import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Link } from "wouter";
import { api, type DocumentationFeedback } from "../lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui";

const statuses: DocumentationFeedback["status"][] = [
  "new",
  "reviewed",
  "accepted",
  "planned",
  "resolved",
  "declined",
];

export default function AdminDocsFeedback() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["docsFeedback"], queryFn: () => api.getDocsFeedback() });
  const review = useMutation({
    mutationFn: ({ id, status }: { id: number; status: DocumentationFeedback["status"] }) => api.reviewDocsFeedback(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docsFeedback"] });
      queryClient.invalidateQueries({ queryKey: ["newDocsFeedbackCount"] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Documentation Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private comments submitted by signed-in reviewers.</p>
        </div>
        <a href="/api/admin/docs/feedback/export?status=accepted" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <Download className="h-4 w-4" /> Export accepted feedback
        </a>
      </header>
      {isLoading ? <p>Loading...</p> : data?.feedback.length ? (
        <div className="space-y-4">
          {data.feedback.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{item.pageTitle}</p>
                    <CardTitle className="mt-1 text-lg">
                      <Link href={`/docs/${item.pageSlug}${item.sectionId ? `#${item.sectionId}` : ""}`} className="text-primary hover:underline">
                        {item.sectionTitle || "Whole-page feedback"}
                      </Link>
                    </CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">Revision {item.documentationRevision}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><strong>{item.helpful ? "Helpful" : "Not helpful"}</strong> / {item.category} / submitted by {item.submittedBy}</p>
                {item.comment && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{item.comment}</p>}
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <Button key={status} size="sm" variant={item.status === status ? "default" : "outline"} disabled={review.isPending} onClick={() => review.mutate({ id: item.id, status })}>
                      {status}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <p className="text-muted-foreground">No documentation feedback has been submitted.</p>}
    </div>
  );
}
