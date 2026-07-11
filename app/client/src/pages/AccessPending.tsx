import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, Info, MailCheck, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui";

export default function AccessPending() {
  const { user, isLoading, portalAccess, emailVerificationRequired, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
    if (!isLoading && portalAccess) setLocation("/dashboard");
  }, [isLoading, user, portalAccess, setLocation]);

  if (isLoading || !user) return null;
  const emailVerified = Boolean(user.emailVerifiedAt);
  const approved = user.status === "active";

  const resend = async () => {
    setSending(true);
    setMessage("");
    setError("");
    try {
      const result = await api.resendEmailVerification();
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send verification email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Account Setup</CardTitle>
          <p className="text-sm text-muted-foreground">
            Welcome, {user.fullName}. Your account is signed in, but member information and operations tools remain locked until administrator review is complete.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-md border p-4">
              {!emailVerificationRequired
                ? <Info className="h-5 w-5 shrink-0 text-primary" />
                : emailVerified
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
              <div>
                <p className="font-semibold">Email verification</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {!emailVerificationRequired
                    ? "Temporarily not required. Administrator approval is the only remaining access step."
                    : emailVerified
                      ? `Verified: ${user.email}`
                      : `Use the link sent to ${user.email}.`}
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-md border p-4">
              {approved ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
              <div>
                <p className="font-semibold">Administrator review</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {approved ? "Your access request was approved." : "A church administrator has been notified and will review your request."}
                </p>
              </div>
            </div>
          </div>

          {emailVerificationRequired && !emailVerified && (
            <Button onClick={resend} disabled={sending} className="gap-2">
              <MailCheck className="h-4 w-4" /> {sending ? "Sending..." : "Resend Verification Email"}
            </Button>
          )}
          {message && <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">{message}</p>}
          {error && <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 border-t pt-5 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p>
              Pending accounts have no member, committee, financial, directory, or administrative permissions. Public documentation remains available while you wait.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
