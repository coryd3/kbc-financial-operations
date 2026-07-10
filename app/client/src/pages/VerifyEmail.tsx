import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui";

export default function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const { user, refresh } = useAuth();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const verify = () => {
    setChecking(true);
    api.verifyEmail(token)
      .then(async (response) => {
        setResult({ ok: true, message: response.message });
        if (user) await refresh();
      })
      .catch((error) => setResult({
        ok: false,
        message: error instanceof ApiError ? error.message : "Unable to verify this email address",
      }))
      .finally(() => setChecking(false));
  };

  return (
    <div className="mx-auto mt-12 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {!result ? (
            <>
              <p className="text-muted-foreground">Confirm that you want to verify the email address associated with this portal account.</p>
              <Button onClick={verify} disabled={checking || token.length < 32}>
                {checking ? "Verifying..." : "Verify Email"}
              </Button>
              {token.length < 32 && <p className="text-sm text-destructive">This verification link is incomplete.</p>}
            </>
          ) : (
            <>
              {result.ok
                ? <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                : <XCircle className="mx-auto h-10 w-10 text-destructive" />}
              <p>{result.message}</p>
              <Link href={user ? "/access-pending" : "/login"} className="inline-block font-medium text-primary underline underline-offset-2">
                {user ? "View account status" : "Sign in"}
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
