import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from "../components/ui";
import { Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import type { Announcement } from "@shared/schema";

export default function AdminAnnouncements() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", body: "", isPublic: true });

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: api.getAnnouncements,
  });

  const createMut = useMutation({
    mutationFn: api.createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      resetForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Announcement> }) => 
      api.updateAnnouncement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: api.deleteAnnouncement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const resetForm = () => {
    setFormData({ title: "", body: "", isPublic: true });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      body: announcement.body,
      isPublic: announcement.isPublic,
    });
    setEditingId(announcement.id);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMut.mutate({ id: editingId, data: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Announcements</h1>
          <p className="text-muted-foreground mt-1">Manage public and member-only announcements.</p>
        </div>
        {!isFormOpen && (
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Announcement" : "Create Announcement"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message Body</Label>
                <textarea
                  id="body"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                />
                <Label htmlFor="isPublic" className="font-normal">Visible to the public (uncheck for member-only)</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {editingId ? "Save Changes" : "Publish"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground py-8">Loading announcements...</div>
        ) : data?.announcements.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center bg-muted/30 rounded-lg border border-border border-dashed">
            No announcements found.
          </div>
        ) : (
          data?.announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="pb-3 flex flex-row justify-between items-start gap-4">
                <div>
                  <CardTitle className="text-xl">{announcement.title}</CardTitle>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="bg-muted px-2 py-1 rounded">
                      {format(new Date(announcement.createdAt), "MMM d, yyyy")}
                    </span>
                    <span className={`px-2 py-1 rounded font-medium ${announcement.isPublic ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {announcement.isPublic ? "Public" : "Member Only"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(announcement)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this announcement?")) {
                        deleteMut.mutate(announcement.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 line-clamp-3">{announcement.body}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
