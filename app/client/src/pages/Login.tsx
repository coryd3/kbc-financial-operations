import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, PasswordInput } from "../components/ui";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { user, refresh, portalAccess, mfaRequired, mfaVerified } = useAuth();

  useEffect(() => {
    if (user) {
      setLocation(!portalAccess ? "/access-pending" : user.mustChangePassword || (mfaRequired && !mfaVerified) ? "/account" : "/dashboard");
    }
  }, [user, portalAccess, mfaRequired, mfaVerified, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const result = await api.login({ username, password });
      await refresh();
      setLocation(!result.portalAccess ? "/access-pending" : result.user.mustChangePassword || result.mfaRequired || result.mfaSetupRequired ? "/account" : "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6">
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl text-primary">Login</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Welcome back to the portal.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account? <Link href="/register" className="text-primary hover:underline">Register here</Link>
          </div>
          <div className="mt-2 text-center text-sm"><Link href="/reset-password" className="text-primary hover:underline">Use a password reset code</Link></div>
        </CardContent>
      </Card>
    </div>
  );
}
