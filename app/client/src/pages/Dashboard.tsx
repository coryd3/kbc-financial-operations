import { useAuth } from "../lib/auth";
import { ROLE_LABELS } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui";
import { Calendar, Lock, Users, Receipt, FileText, CheckSquare, Settings, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: api.getAnnouncements,
  });

  const { data: checklistSummary } = useQuery({
    queryKey: ["checklistSummary"],
    queryFn: api.getChecklistSummary,
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Welcome, {user.fullName}</h1>
          <p className="text-muted-foreground mt-1">Role: <span className="font-medium text-foreground">{ROLE_LABELS[user.role]}</span></p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-serif font-semibold border-b border-border pb-2">Recent Announcements</h2>
          
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-muted rounded-lg"></div>
              <div className="h-32 bg-muted rounded-lg"></div>
            </div>
          ) : data?.announcements.length ? (
            <div className="space-y-4">
              {data.announcements.map((announcement) => (
                <Card key={announcement.id} className={!announcement.isPublic ? "border-accent/30 bg-accent/5" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{announcement.title}</CardTitle>
                        {!announcement.isPublic && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-accent/20 text-accent px-2 py-0.5 rounded-sm w-max">
                            <Lock className="w-3 h-3" /> Member Only
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap bg-muted px-2 py-1 rounded-md w-max">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(announcement.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {announcement.body}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No current announcements.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-serif font-semibold border-b border-border pb-2">Tasks &amp; Checklists</h2>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md text-primary">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {checklistSummary ? `${checklistSummary.myOpenSteps} open step${checklistSummary.myOpenSteps === 1 ? "" : "s"} for you` : "Loading..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {checklistSummary ? `${checklistSummary.openCount} active checklist${checklistSummary.openCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {checklistSummary && checklistSummary.overdue.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Overdue
                  </p>
                  {checklistSummary.overdue.map((i) => (
                    <Link key={i.id} href={`/checklists/${i.id}`} className="block text-sm p-2 rounded-md bg-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-colors">
                      <span className="font-medium">{i.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Due {i.dueDate ? format(new Date(i.dueDate), "MMM d") : ""} · {i.progress.completed}/{i.progress.total} steps done
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {checklistSummary && checklistSummary.upcoming.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Due Soon
                  </p>
                  {checklistSummary.upcoming.map((i) => (
                    <Link key={i.id} href={`/checklists/${i.id}`} className="block text-sm p-2 rounded-md bg-muted/50 border border-border hover:border-primary/40 transition-colors">
                      <span className="font-medium">{i.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Due {i.dueDate ? format(new Date(i.dueDate), "MMM d") : ""} · {i.progress.completed}/{i.progress.total} steps done
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {checklistSummary && !checklistSummary.overdue.length && !checklistSummary.upcoming.length && (
                <p className="text-sm text-muted-foreground">Nothing overdue or due soon. Nice work!</p>
              )}

              <Link href="/checklists" className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium">
                View all checklists <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>

          <h2 className="text-2xl font-serif font-semibold border-b border-border pb-2">Future Modules</h2>
          <div className="grid gap-3">
            {[
              { title: "Finance Dashboard", icon: Receipt, desc: "Budget tracking and reports" },
              { title: "Giving Records", icon: FileText, desc: "Contribution statements" },
              { title: "Member Directory", icon: Users, desc: "Congregation contact list" },
              { title: "Committees", icon: Settings, desc: "Group workspaces" },
            ].map((module, i) => (
              <Card key={i} className="opacity-60 grayscale cursor-not-allowed">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md text-muted-foreground">
                    <module.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{module.title}</h3>
                    <p className="text-xs text-muted-foreground">{module.desc}</p>
                  </div>
                  <span className="ml-auto text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-sm">
                    Soon
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
