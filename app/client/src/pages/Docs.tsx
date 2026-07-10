import { DOCS_TOPICS, DOCS_BASE_URL } from "../lib/docs-links";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui";
import { ExternalLink, BookText } from "lucide-react";

export default function Docs() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-serif text-primary font-bold">Documentation Hub</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Central repository for church policies, procedures, committee charters, and operation guides. 
          Links open in the external documentation site.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DOCS_TOPICS.map((topic, i) => (
          <Card key={i} className="flex flex-col h-full hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary mb-2">
                <BookText className="w-5 h-5" />
                <CardTitle className="text-xl">{topic.title}</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">{topic.description}</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-0 mt-auto">
              <ul className="space-y-2 mt-4 border-t border-border pt-4">
                {topic.links.map((link, j) => (
                  <li key={j}>
                    <a
                      href={`${DOCS_BASE_URL}${link.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-foreground/80 hover:text-accent flex items-center gap-1.5 transition-colors group"
                    >
                      <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
