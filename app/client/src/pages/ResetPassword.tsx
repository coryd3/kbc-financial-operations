import { useState } from "react";
import { Link } from "wouter";
import { api, ApiError } from "../lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../components/ui";

export default function ResetPassword() {
  const [username, setUsername] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.resetPassword({ username, resetCode, newPassword });
      setMessage("Password reset. You can now sign in.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset the password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto mt-12 max-w-md">
      <CardHeader><CardTitle className="text-2xl text-primary">Reset Password</CardTitle></CardHeader>
      <CardContent>
        {message ? <div className="space-y-4"><p>{message}</p><Link href="/login" className="text-primary underline">Return to login</Link></div> : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">Use the one-time code provided privately by a system administrator.</p>
            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <div><Label htmlFor="reset-username">Username</Label><Input id="reset-username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
            <div><Label htmlFor="reset-code">Reset code</Label><Input id="reset-code" value={resetCode} onChange={(event) => setResetCode(event.target.value)} required /></div>
            <div><Label htmlFor="reset-password">New password</Label><Input id="reset-password" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div>
            <Button className="w-full" disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
