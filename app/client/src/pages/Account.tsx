import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api, ApiError } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from "../components/ui";
import { useLocation } from "wouter";

function MemberProfileCard() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hideEmail, setHideEmail] = useState(false);
  const [hidePhone, setHidePhone] = useState(false);
  const [hideAddress, setHideAddress] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["myMemberProfile"],
    queryFn: () => api.getMyMemberProfile(),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const member = data?.member;

  useEffect(() => {
    if (member) {
      setEmail(member.email ?? "");
      setPhone(member.phone ?? "");
      setAddress(member.address ?? "");
      setHideEmail(member.hideEmail);
      setHidePhone(member.hidePhone);
      setHideAddress(member.hideAddress);
    }
  }, [member]);

  const saveMut = useMutation({
    mutationFn: () =>
      api.updateMyMemberProfile({ email, phone, address, hideEmail, hidePhone, hideAddress }),
    onSuccess: () => {
      setError("");
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["myMemberProfile"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err) => {
      setSuccess(false);
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    },
  });

  const notLinked = loadError instanceof ApiError && loadError.status === 404;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-primary">My Member Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : notLinked ? (
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to a member profile yet. Once the church office links your
            profile, you'll be able to update your contact info and directory privacy here.
          </p>
        ) : member ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate();
            }}
          >
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-primary font-medium text-sm">
                Profile updated.
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {member.firstName} {member.lastName} — this is what appears in the member directory.
            </p>
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email</Label>
              <Input id="profileEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profilePhone">Phone</Label>
              <Input id="profilePhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileAddress">Address</Label>
              <Input id="profileAddress" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-muted-foreground">Privacy — hide from other members in the directory</Label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={hideEmail} onChange={(e) => setHideEmail(e.target.checked)} />
                  Hide email
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={hidePhone} onChange={(e) => setHidePhone(e.target.checked)} />
                  Hide phone
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={hideAddress} onChange={(e) => setHideAddress(e.target.checked)} />
                  Hide address
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Church leadership can always see your contact info for official records.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReminderPrefsCard() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [notifyDueSoon, setNotifyDueSoon] = useState(user?.notifyDueSoon ?? true);
  const [notifyOverdue, setNotifyOverdue] = useState(user?.notifyOverdue ?? true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setNotifyDueSoon(user.notifyDueSoon);
      setNotifyOverdue(user.notifyOverdue);
    }
  }, [user?.notifyDueSoon, user?.notifyOverdue]);

  const saveMut = useMutation({
    mutationFn: () => api.updateNotificationPrefs({ notifyDueSoon, notifyOverdue }),
    onSuccess: async () => {
      setError("");
      setSuccess(true);
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      setSuccess(false);
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-primary">Checklist Reminders</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
        >
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-primary font-medium text-sm">
              Reminder preferences saved.
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Choose when you'd like an in-app reminder about checklists with open steps assigned to
            you. Reminders appear under the bell icon in the header.
          </p>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyDueSoon}
                onChange={(e) => setNotifyDueSoon(e.target.checked)}
              />
              Remind me the day before a checklist is due
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyOverdue}
                onChange={(e) => setNotifyOverdue(e.target.checked)}
              />
              Remind me when a checklist is overdue
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving..." : "Save Reminder Preferences"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MfaCard() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [token, setToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const beginSetup = async () => {
    setLoading(true);
    setError("");
    try {
      setSetup(await api.getMfaSetup());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to start MFA setup");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      if (user?.mfaEnabled) {
        await api.verifyMfa(token);
      } else {
        const result = await api.enableMfa(token);
        setRecoveryCodes(result.recoveryCodes);
      }
      setToken("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to verify that code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-primary">Multi-Factor Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {recoveryCodes.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Save these one-time recovery codes in a secure place. They will not be shown again.</p>
            <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
              {recoveryCodes.map((code) => <span key={code}>{code}</span>)}
            </div>
            <Button onClick={() => setRecoveryCodes([])}>I saved the codes</Button>
          </div>
        ) : user?.mfaEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the six-digit code from your authenticator app, or use one recovery code.</p>
            <Label htmlFor="mfa-token">Verification code</Label>
            <Input id="mfa-token" autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} />
            <Button disabled={loading || !token.trim()} onClick={submit}>{loading ? "Verifying..." : "Verify"}</Button>
          </div>
        ) : setup ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Scan this code with an authenticator app, then enter the six-digit code it shows.</p>
            <img src={setup.qrDataUrl} alt="Authenticator setup QR code" className="mx-auto h-60 w-60 rounded border" />
            <details className="text-sm"><summary>Cannot scan the code?</summary><code className="mt-2 block break-all rounded bg-muted p-2">{setup.secret}</code></details>
            <Label htmlFor="mfa-enable-token">Verification code</Label>
            <Input id="mfa-enable-token" autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} />
            <Button disabled={loading || !token.trim()} onClick={submit}>{loading ? "Enabling..." : "Enable MFA"}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This role requires an authenticator app to protect church operational and financial access.</p>
            <Button disabled={loading} onClick={beginSetup}>{loading ? "Starting..." : "Set Up MFA"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Account() {
  const { user, refresh, mfaRequired, mfaVerified } = useAuth();
  const [, setLocation] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refresh();
      if (user?.mustChangePassword) {
        setTimeout(() => setLocation("/dashboard"), 1500);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      {user?.mustChangePassword && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md shadow-sm">
          <h3 className="font-semibold mb-1">Password Change Required</h3>
          <p className="text-sm text-destructive/90">
            For security reasons, you must change your temporary password before accessing the portal.
          </p>
        </div>
      )}

      {!user?.mustChangePassword && mfaRequired && !mfaVerified && <MfaCard />}
      {!user?.mustChangePassword && (!mfaRequired || mfaVerified) && <MemberProfileCard />}
      {!user?.mustChangePassword && (!mfaRequired || mfaVerified) && <ReminderPrefsCard />}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-primary font-medium text-sm">
                Password changed successfully.
                {user?.mustChangePassword && " Redirecting to dashboard..."}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
