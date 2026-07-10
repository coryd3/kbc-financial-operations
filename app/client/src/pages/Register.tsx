import { useState } from "react";
import { Link } from "wouter";
import { api, ApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, PasswordInput } from "../components/ui";

export default function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const result = await api.register(formData);
      setEmailSent(result.emailSent);
      setIsSuccess(true);
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

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card className="text-center p-6 border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Registration Received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground/80">
              Your account request has been received. You can sign in now to follow the two setup steps.
            </p>
            <p className="text-sm text-muted-foreground">
              {emailSent
                ? "Check your email for a verification link. Member access begins after both email verification and administrator approval."
                : "Email delivery is not configured yet. Sign in to view your status and contact a portal administrator for help verifying your email."}
            </p>
            <div className="pt-4">
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign In and View Status
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6">
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl text-primary">Register</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Request access to the member portal.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Registration"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Login here</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
