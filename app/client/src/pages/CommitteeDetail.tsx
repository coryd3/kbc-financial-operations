import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type CommitteeMemberInput,
  type MeetingInput,
  type DecisionInput,
} from "../lib/api";
import {
  COMMITTEE_POSITIONS,
  COMMITTEE_POSITION_LABELS,
  DECISION_STATUSES,
  DECISION_STATUS_LABELS,
  type Meeting,
  type Decision,
} from "@shared/schema";
import { Button, Card, CardContent, Input, Label } from "../components/ui";
import { Users, Lock, Plus, Calendar, Gavel, Trash2, Pencil, ArrowLeft, X } from "lucide-react";
import { format } from "date-fns";

function formatDate(d: string | null | undefined) {
  if (!d) return "TBD";
  try {
    return format(new Date(d + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return d;
  }
}

const inputClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function CommitteeDetail() {
  const [, params] = useRoute("/committees/:id");
  const committeeId = Number(params?.id);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["committee", committeeId],
    queryFn: () => api.getCommittee(committeeId),
    enabled: Number.isInteger(committeeId),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["committee", committeeId] });
    queryClient.invalidateQueries({ queryKey: ["committees"] });
    queryClient.invalidateQueries({ queryKey: ["decisions"] });
    queryClient.invalidateQueries({ queryKey: ["governanceOverview"] });
  };

  const [actionError, setActionError] = useState<string | null>(null);
  const onError = (err: unknown) =>
    setActionError(err instanceof ApiError ? err.message : "Something went wrong");

  // ----- Roster form -----
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState<CommitteeMemberInput>({ userId: 0, position: "member" });
  const { data: eligible } = useQuery({
    queryKey: ["eligibleUsers", committeeId],
    queryFn: () => api.getEligibleUsers(committeeId),
    enabled: showMemberForm && !!data?.canManage,
  });
  const addMember = useMutation({
    mutationFn: (input: CommitteeMemberInput) => api.addCommitteeMember(committeeId, input),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["eligibleUsers", committeeId] });
      setShowMemberForm(false);
      setMemberForm({ userId: 0, position: "member" });
      setActionError(null);
    },
    onError,
  });
  const removeMember = useMutation({
    mutationFn: (memberId: number) => api.removeCommitteeMember(committeeId, memberId),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["eligibleUsers", committeeId] });
    },
    onError,
  });
  const updateMemberPosition = useMutation({
    mutationFn: ({ memberId, position }: { memberId: number; position: CommitteeMemberInput["position"] }) =>
      api.updateCommitteeMember(committeeId, memberId, { position }),
    onSuccess: invalidate,
    onError,
  });

  // ----- Meeting form -----
  const emptyMeeting: MeetingInput = { title: "", meetingDate: "", attendees: "", agenda: "", minutes: "" };
  const [meetingFormOpen, setMeetingFormOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingInput>(emptyMeeting);
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null);

  const saveMeeting = useMutation({
    mutationFn: (input: MeetingInput) =>
      editingMeetingId
        ? api.updateMeeting(committeeId, editingMeetingId, input)
        : api.createMeeting(committeeId, input),
    onSuccess: () => {
      invalidate();
      setMeetingFormOpen(false);
      setEditingMeetingId(null);
      setMeetingForm(emptyMeeting);
      setActionError(null);
    },
    onError,
  });
  const deleteMeeting = useMutation({
    mutationFn: (meetingId: number) => api.deleteMeeting(committeeId, meetingId),
    onSuccess: invalidate,
    onError,
  });

  const startEditMeeting = (m: Meeting) => {
    setEditingMeetingId(m.id);
    setMeetingForm({
      title: m.title,
      meetingDate: m.meetingDate,
      attendees: m.attendees ?? "",
      agenda: m.agenda ?? "",
      minutes: m.minutes ?? "",
    });
    setMeetingFormOpen(true);
  };

  // ----- Decision form -----
  const emptyDecision: DecisionInput = {
    committeeId,
    meetingId: null,
    decisionDate: "",
    decision: "",
    owner: "",
    status: "proposed",
    notes: "",
  };
  const [decisionFormOpen, setDecisionFormOpen] = useState(false);
  const [editingDecisionId, setEditingDecisionId] = useState<number | null>(null);
  const [decisionForm, setDecisionForm] = useState<DecisionInput>(emptyDecision);

  const saveDecision = useMutation({
    mutationFn: (input: DecisionInput) =>
      editingDecisionId ? api.updateDecision(editingDecisionId, input) : api.createDecision(input),
    onSuccess: () => {
      invalidate();
      setDecisionFormOpen(false);
      setEditingDecisionId(null);
      setDecisionForm(emptyDecision);
      setActionError(null);
    },
    onError,
  });
  const deleteDecision = useMutation({
    mutationFn: (id: number) => api.deleteDecision(id),
    onSuccess: invalidate,
    onError,
  });

  const startEditDecision = (d: Decision) => {
    setEditingDecisionId(d.id);
    setDecisionForm({
      committeeId,
      meetingId: d.meetingId,
      decisionDate: d.decisionDate ?? "",
      decision: d.decision,
      owner: d.owner ?? "",
      status: d.status,
      notes: d.notes ?? "",
    });
    setDecisionFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-muted rounded-lg"></div>
        <div className="h-48 bg-muted rounded-lg"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 space-y-4">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
        <h2 className="text-2xl font-serif font-bold text-primary">
          {error instanceof ApiError && error.status === 403
            ? "This committee's records are restricted"
            : "Committee not found"}
        </h2>
        <p className="text-muted-foreground">
          {error instanceof ApiError && error.status === 403
            ? "Only members of this committee can view its meetings and minutes."
            : "The committee you're looking for doesn't exist."}
        </p>
        <Link href="/committees" className="text-primary underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to committees
        </Link>
      </div>
    );
  }

  const { committee, roster, meetings, decisions, canManage } = data;
  const meetingById = new Map(meetings.map((m) => [m.id, m]));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/committees" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" /> All committees
        </Link>
        <header className="border-b border-border pb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-serif text-primary font-bold">{committee.name}</h1>
            {committee.isSensitive && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-accent/20 text-accent px-2 py-0.5 rounded-sm">
                <Lock className="w-3 h-3" /> Restricted
              </span>
            )}
          </div>
          {committee.description && (
            <p className="text-muted-foreground mt-2 max-w-3xl">{committee.description}</p>
          )}
        </header>
      </div>

      {actionError && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md px-4 py-3 flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ---------- Meetings & decisions ---------- */}
        <div className="lg:col-span-2 space-y-10">
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Meetings & Minutes
              </h2>
              {canManage && (
                <Button size="sm" onClick={() => { setMeetingFormOpen((v) => !v); setEditingMeetingId(null); setMeetingForm(emptyMeeting); }}>
                  <Plus className="w-4 h-4 mr-1" /> Record Meeting
                </Button>
              )}
            </div>

            {meetingFormOpen && (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-serif font-semibold text-lg">
                    {editingMeetingId ? "Edit Meeting" : "Record a Meeting"}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input
                        value={meetingForm.title}
                        onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                        placeholder="e.g. July Regular Meeting"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={meetingForm.meetingDate}
                        onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Attendees</Label>
                    <Input
                      value={meetingForm.attendees}
                      onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                      placeholder="Names, separated by commas"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Agenda</Label>
                    <textarea
                      className={inputClass + " min-h-[80px]"}
                      value={meetingForm.agenda}
                      onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                      placeholder="Agenda items for this meeting"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Minutes</Label>
                    <textarea
                      className={inputClass + " min-h-[140px]"}
                      value={meetingForm.minutes}
                      onChange={(e) => setMeetingForm({ ...meetingForm, minutes: e.target.value })}
                      placeholder="Minutes / notes from the meeting"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveMeeting.mutate(meetingForm)}
                      disabled={saveMeeting.isPending || !meetingForm.title.trim() || !meetingForm.meetingDate}
                    >
                      {saveMeeting.isPending ? "Saving..." : editingMeetingId ? "Save Changes" : "Save Meeting"}
                    </Button>
                    <Button variant="outline" onClick={() => { setMeetingFormOpen(false); setEditingMeetingId(null); }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {meetings.length ? (
              <div className="space-y-3">
                {meetings.map((m) => {
                  const linkedDecisions = decisions.filter((d) => d.meetingId === m.id);
                  const expanded = expandedMeeting === m.id;
                  return (
                    <Card key={m.id}>
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start gap-3">
                          <button
                            className="text-left flex-1"
                            onClick={() => setExpandedMeeting(expanded ? null : m.id)}
                          >
                            <h3 className="font-serif font-semibold text-lg hover:text-primary transition-colors">
                              {m.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {formatDate(m.meetingDate)}
                              {linkedDecisions.length > 0 && (
                                <span className="ml-2 text-primary font-medium">
                                  {linkedDecisions.length} decision{linkedDecisions.length === 1 ? "" : "s"}
                                </span>
                              )}
                            </p>
                          </button>
                          {canManage && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEditMeeting(m)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Delete this meeting record? Linked decisions will remain in the decision log.")) {
                                    deleteMeeting.mutate(m.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {expanded && (
                          <div className="mt-4 pt-4 border-t border-border space-y-4 text-sm">
                            {m.attendees && (
                              <div>
                                <h4 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-1">Attendees</h4>
                                <p>{m.attendees}</p>
                              </div>
                            )}
                            {m.agenda && (
                              <div>
                                <h4 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-1">Agenda</h4>
                                <p className="whitespace-pre-wrap">{m.agenda}</p>
                              </div>
                            )}
                            {m.minutes && (
                              <div>
                                <h4 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-1">Minutes</h4>
                                <p className="whitespace-pre-wrap">{m.minutes}</p>
                              </div>
                            )}
                            {linkedDecisions.length > 0 && (
                              <div>
                                <h4 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-1">Decisions from this meeting</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                  {linkedDecisions.map((d) => (
                                    <li key={d.id}>
                                      {d.decision}{" "}
                                      <span className="text-xs text-muted-foreground">
                                        ({DECISION_STATUS_LABELS[d.status]})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!m.attendees && !m.agenda && !m.minutes && linkedDecisions.length === 0 && (
                              <p className="text-muted-foreground">No details recorded for this meeting yet.</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-muted/50 rounded-lg border border-border border-dashed">
                <p className="text-muted-foreground">No meetings recorded yet.</p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
                <Gavel className="w-5 h-5 text-primary" /> Decisions
              </h2>
              {canManage && (
                <Button size="sm" onClick={() => { setDecisionFormOpen((v) => !v); setEditingDecisionId(null); setDecisionForm(emptyDecision); }}>
                  <Plus className="w-4 h-4 mr-1" /> Record Decision
                </Button>
              )}
            </div>

            {decisionFormOpen && (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-serif font-semibold text-lg">
                    {editingDecisionId ? "Edit Decision" : "Record a Decision"}
                  </h3>
                  <div className="space-y-1.5">
                    <Label>Decision / Motion</Label>
                    <textarea
                      className={inputClass + " min-h-[80px]"}
                      value={decisionForm.decision}
                      onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })}
                      placeholder="What was decided or moved?"
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={decisionForm.decisionDate}
                        onChange={(e) => setDecisionForm({ ...decisionForm, decisionDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Outcome / Status</Label>
                      <select
                        className={inputClass + " h-10"}
                        value={decisionForm.status}
                        onChange={(e) => setDecisionForm({ ...decisionForm, status: e.target.value as DecisionInput["status"] })}
                      >
                        {DECISION_STATUSES.map((s) => (
                          <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Linked Meeting</Label>
                      <select
                        className={inputClass + " h-10"}
                        value={decisionForm.meetingId ?? ""}
                        onChange={(e) =>
                          setDecisionForm({ ...decisionForm, meetingId: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">None</option>
                        {meetings.map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatDate(m.meetingDate)} — {m.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Owner</Label>
                    <Input
                      value={decisionForm.owner}
                      onChange={(e) => setDecisionForm({ ...decisionForm, owner: e.target.value })}
                      placeholder="Who is responsible for this decision?"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <textarea
                      className={inputClass + " min-h-[80px]"}
                      value={decisionForm.notes}
                      onChange={(e) => setDecisionForm({ ...decisionForm, notes: e.target.value })}
                      placeholder="Context, motion language, follow-up needed, etc."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveDecision.mutate(decisionForm)}
                      disabled={saveDecision.isPending || !decisionForm.decision.trim()}
                    >
                      {saveDecision.isPending ? "Saving..." : editingDecisionId ? "Save Changes" : "Save Decision"}
                    </Button>
                    <Button variant="outline" onClick={() => { setDecisionFormOpen(false); setEditingDecisionId(null); }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {decisions.length ? (
              <div className="space-y-3">
                {decisions.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{d.decision}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span>{formatDate(d.decisionDate)}</span>
                            <span className="bg-muted px-2 py-0.5 rounded-sm font-medium">
                              {DECISION_STATUS_LABELS[d.status]}
                            </span>
                            {d.owner && <span>Owner: {d.owner}</span>}
                            {d.meetingId && meetingById.get(d.meetingId) && (
                              <span className="text-primary">
                                From: {meetingById.get(d.meetingId)!.title}
                              </span>
                            )}
                          </div>
                          {d.notes && (
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{d.notes}</p>
                          )}
                        </div>
                        {canManage && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startEditDecision(d)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Delete this decision entry?")) deleteDecision.mutate(d.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-muted/50 rounded-lg border border-border border-dashed">
                <p className="text-muted-foreground">No decisions recorded for this committee yet.</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------- Roster ---------- */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h2 className="text-2xl font-serif font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Roster
            </h2>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setShowMemberForm((v) => !v)}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            )}
          </div>

          {showMemberForm && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Member</Label>
                  <select
                    className={inputClass + " h-10"}
                    value={memberForm.userId || ""}
                    onChange={(e) => setMemberForm({ ...memberForm, userId: Number(e.target.value) })}
                  >
                    <option value="">Select a member...</option>
                    {eligible?.users.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <select
                    className={inputClass + " h-10"}
                    value={memberForm.position}
                    onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value as CommitteeMemberInput["position"] })}
                  >
                    {COMMITTEE_POSITIONS.map((p) => (
                      <option key={p} value={p}>{COMMITTEE_POSITION_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Term Start</Label>
                    <Input
                      type="date"
                      value={memberForm.termStart ?? ""}
                      onChange={(e) => setMemberForm({ ...memberForm, termStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Term End</Label>
                    <Input
                      type="date"
                      value={memberForm.termEnd ?? ""}
                      onChange={(e) => setMemberForm({ ...memberForm, termEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => addMember.mutate(memberForm)}
                    disabled={addMember.isPending || !memberForm.userId}
                  >
                    {addMember.isPending ? "Adding..." : "Add to Roster"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowMemberForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {roster.length ? (
            <div className="space-y-2">
              {roster.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {canManage ? (
                          <select
                            className="bg-transparent border border-input rounded-sm text-xs py-0.5 px-1 mt-1"
                            value={r.position}
                            onChange={(e) =>
                              updateMemberPosition.mutate({
                                memberId: r.id,
                                position: e.target.value as CommitteeMemberInput["position"],
                              })
                            }
                          >
                            {COMMITTEE_POSITIONS.map((p) => (
                              <option key={p} value={p}>{COMMITTEE_POSITION_LABELS[p]}</option>
                            ))}
                          </select>
                        ) : (
                          COMMITTEE_POSITION_LABELS[r.position]
                        )}
                      </p>
                      {(r.termStart || r.termEnd) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Term: {r.termStart ? formatDate(r.termStart) : "—"} to {r.termEnd ? formatDate(r.termEnd) : "—"}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remove ${r.fullName} from this committee?`)) removeMember.mutate(r.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground text-sm">No members on the roster yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
