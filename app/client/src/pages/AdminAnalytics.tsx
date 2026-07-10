import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui";
import { Users, Eye, MousePointerClick } from "lucide-react";
import { ROLE_LABELS, Role } from "@shared/schema";

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => api.getAnalyticsSummary(days),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Portal Analytics</h1>
          <p className="text-muted-foreground mt-1">Usage statistics and page views.</p>
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      ) : data ? (
        <>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Page Views</p>
                  <h3 className="text-3xl font-bold font-serif">{data.totals.totalViews.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-accent/10 text-accent rounded-full">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unique Visitors</p>
                  <h3 className="text-3xl font-bold font-serif">{data.totals.uniqueVisitors.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <MousePointerClick className="w-5 h-5 text-primary" /> Top Pages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topPages.map((page, i) => (
                    <div key={i} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-sm truncate text-foreground/90 group-hover:text-primary transition-colors" title={page.path}>
                          {page.path}
                        </span>
                      </div>
                      <span className="text-sm font-medium bg-muted px-2 py-0.5 rounded shrink-0">
                        {page.views.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {data.topPages.length === 0 && (
                    <p className="text-sm text-muted-foreground">No page views recorded.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Views by Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.byRole.map((roleStat, i) => {
                    const label = roleStat.role ? ROLE_LABELS[roleStat.role as Role] || roleStat.role : "Public / Unauthenticated";
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-foreground/90">{label}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className="h-full bg-primary/60" 
                              style={{ 
                                width: `${(roleStat.views / data.totals.totalViews) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {roleStat.views.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {data.byRole.length === 0 && (
                    <p className="text-sm text-muted-foreground">No role data available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
