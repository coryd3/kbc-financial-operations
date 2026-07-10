import { Switch, Route } from "wouter";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Docs from "./pages/Docs";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import Directory from "./pages/Directory";
import AdminUsers from "./pages/AdminUsers";
import AdminMembers from "./pages/AdminMembers";
import Checklists from "./pages/Checklists";
import ChecklistDetail from "./pages/ChecklistDetail";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import ChecklistHistory from "./pages/ChecklistHistory";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminAnalytics from "./pages/AdminAnalytics";
import Committees from "./pages/Committees";
import CommitteeDetail from "./pages/CommitteeDetail";
import Decisions from "./pages/Decisions";
import FinanceCounts from "./pages/finance/FinanceCounts";
import FinanceDeposits from "./pages/finance/FinanceDeposits";
import FinanceLedger from "./pages/finance/FinanceLedger";
import FinanceClose from "./pages/finance/FinanceClose";
import FinanceReports from "./pages/finance/FinanceReports";
import FinanceCategories from "./pages/finance/FinanceCategories";
import FinanceGiving from "./pages/finance/FinanceGiving";
import FinanceGivingBatch from "./pages/finance/FinanceGivingBatch";
import FinanceDonors from "./pages/finance/FinanceDonors";
import FinanceDonorDetail from "./pages/finance/FinanceDonorDetail";
import FinanceFunds from "./pages/finance/FinanceFunds";
import { FinanceIndexRedirect } from "./pages/finance/FinanceIndexRedirect";
import {
  COUNT_VIEW_ROLES,
  FINANCE_VIEW_ROLES,
  FINANCE_NAV_ROLES,
  REPORT_VIEW_ROLES,
  CATEGORY_MANAGE_ROLES,
  GIVING_ROLES,
  FUND_REPORT_ROLES,
} from "@shared/schema";

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

        <Route path="/checklists">
          <ProtectedRoute><Checklists /></ProtectedRoute>
        </Route>

        <Route path="/checklists/templates">
          <ProtectedRoute><ChecklistTemplates /></ProtectedRoute>
        </Route>

        <Route path="/checklists/templates/:id/history">
          <ProtectedRoute><ChecklistHistory /></ProtectedRoute>
        </Route>

        <Route path="/checklists/:id">
          <ProtectedRoute><ChecklistDetail /></ProtectedRoute>
        </Route>
        
        <Route path="/directory">
          <ProtectedRoute><Directory /></ProtectedRoute>
        </Route>
        
        <Route path="/admin/members">
          <ProtectedRoute requireLeadership><AdminMembers /></ProtectedRoute>
        </Route>

        <Route path="/committees">
          <ProtectedRoute><Committees /></ProtectedRoute>
        </Route>
        
        <Route path="/committees/:id">
          <ProtectedRoute><CommitteeDetail /></ProtectedRoute>
        </Route>
        
        <Route path="/decisions">
          <ProtectedRoute><Decisions /></ProtectedRoute>
        </Route>
        
        <Route path="/finance">
          <ProtectedRoute allowedRoles={FINANCE_NAV_ROLES}><FinanceIndexRedirect /></ProtectedRoute>
        </Route>

        <Route path="/finance/counts">
          <ProtectedRoute allowedRoles={COUNT_VIEW_ROLES}><FinanceCounts /></ProtectedRoute>
        </Route>

        <Route path="/finance/deposits">
          <ProtectedRoute allowedRoles={FINANCE_VIEW_ROLES}><FinanceDeposits /></ProtectedRoute>
        </Route>

        <Route path="/finance/giving">
          <ProtectedRoute allowedRoles={GIVING_ROLES}><FinanceGiving /></ProtectedRoute>
        </Route>

        <Route path="/finance/giving/:id">
          <ProtectedRoute allowedRoles={GIVING_ROLES}><FinanceGivingBatch /></ProtectedRoute>
        </Route>

        <Route path="/finance/donors">
          <ProtectedRoute allowedRoles={GIVING_ROLES}><FinanceDonors /></ProtectedRoute>
        </Route>

        <Route path="/finance/donors/:id">
          <ProtectedRoute allowedRoles={GIVING_ROLES}><FinanceDonorDetail /></ProtectedRoute>
        </Route>

        <Route path="/finance/funds">
          <ProtectedRoute allowedRoles={FUND_REPORT_ROLES}><FinanceFunds /></ProtectedRoute>
        </Route>

        <Route path="/finance/ledger">
          <ProtectedRoute allowedRoles={FINANCE_VIEW_ROLES}><FinanceLedger /></ProtectedRoute>
        </Route>

        <Route path="/finance/close">
          <ProtectedRoute allowedRoles={FINANCE_VIEW_ROLES}><FinanceClose /></ProtectedRoute>
        </Route>

        <Route path="/finance/reports">
          <ProtectedRoute allowedRoles={REPORT_VIEW_ROLES}><FinanceReports /></ProtectedRoute>
        </Route>

        <Route path="/finance/categories">
          <ProtectedRoute allowedRoles={CATEGORY_MANAGE_ROLES}><FinanceCategories /></ProtectedRoute>
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
