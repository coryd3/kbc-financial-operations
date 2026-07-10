import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "../lib/auth";
import { AlertCircle, Calendar, ArrowRight } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: api.getAnnouncements,
  });

  const publicAnnouncements = data?.announcements.filter(a => a.isPublic) || [];

  return (
    <div className="space-y-12">
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl font-serif text-primary font-bold">Welcome to Kingsville Baptist Church</h1>
        <p className="text-xl text-muted-foreground">
          Our online home for church operations, administration, and member resources.
        </p>
        {!user && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-8 text-sm font-medium text-accent-foreground hover:bg-accent/90 shadow-sm transition-colors">
              Register for Access
            </Link>
            <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
              Login
            </Link>
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-serif font-semibold border-b border-border pb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Public Announcements
          </h2>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg"></div>
              ))}
            </div>
          ) : publicAnnouncements.length > 0 ? (
            <div className="space-y-4">
              {publicAnnouncements.map(announcement => (
                <Card key={announcement.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-xl">{announcement.title}</CardTitle>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap bg-muted px-2 py-1 rounded-md">
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
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-primary text-xl">Documentation Hub</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/80">
                Access our church policies, procedures, committee packets, and operation guides.
              </p>
              <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-accent transition-colors">
                Browse Documents <ArrowRight className="w-4 h-4" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/80">
              <p className="font-medium text-foreground">Kingsville Baptist Church</p>
              <p>203 West Adriatic Street</p>
              <p>Kingsville, MO 64061</p>
              <p className="pt-2">
                Phone:{" "}
                <a href="tel:816-597-3684" className="text-primary hover:text-accent transition-colors">
                  816-597-3684
                </a>
              </p>
              <p>
                Email:{" "}
                <a href="mailto:kingsvillebaptist@gmail.com" className="text-primary hover:text-accent transition-colors">
                  kingsvillebaptist@gmail.com
                </a>
              </p>
              <p>
                Website:{" "}
                <a
                  href="https://www.kingsvillebaptistchurch.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-accent transition-colors"
                >
                  kingsvillebaptistchurch.net
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
