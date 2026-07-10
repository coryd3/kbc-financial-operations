import { Switch, Route } from "wouter";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Docs from "./pages/Docs";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import AdminUsers from "./pages/AdminUsers";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminAnalytics from "./pages/AdminAnalytics";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/docs" component={Docs} />
        
        <Route path="/dashboard">
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </Route>
        
        <Route path="/account">
          <ProtectedRoute><Account /></ProtectedRoute>
        </Route>
        
        <Route path="/admin">
          <ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>
        </Route>
        
        <Route path="/admin/announcements">
          <ProtectedRoute requireAdmin><AdminAnnouncements /></ProtectedRoute>
        </Route>
        
        <Route path="/admin/analytics">
          <ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>
        </Route>
        
        <Route>
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <h2 className="text-4xl font-serif font-bold text-primary">404</h2>
            <p className="text-lg text-muted-foreground">The page you're looking for doesn't exist.</p>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}

import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { usePageTracking } from "./lib/track";
import { queryClient } from "./lib/queryClient";

function AppRouter() {
  usePageTracking();
  return <Router />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
