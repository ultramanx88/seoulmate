import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LogOut, Shield, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, parseApiDate } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { Toaster } from './ui/sonner';

type Admin = {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'moderator';
  displayName: string;
};

type Overview = {
  users: { total: number; active: number; suspended: number; banned: number };
  reports: { open: number; reviewing: number; resolved: number };
  content: { topics: number; comments: number; messages: number };
};

type Report = {
  id: string;
  status: string;
  priority: number;
  reason: string;
  detail: string | null;
  reporterName: string | null;
  reportedUserId: string | null;
  reportedName: string | null;
  topicId: string | null;
  commentId: string | null;
  messageId: string | null;
  resolution: string | null;
  createdAt: string | null;
};

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  nationality?: 'TH' | 'KR';
  intent?: string;
  safetyStatus: 'active' | 'suspended' | 'banned' | 'deleted';
  reportsCount: number;
  createdAt: string;
};

const statusTone: Record<string, string> = {
  active: 'border-brand-mint/40 bg-brand-mint/20 text-brand-ink',
  suspended: 'border-amber-200 bg-amber-50 text-amber-700',
  banned: 'border-destructive/20 bg-destructive/10 text-destructive',
  deleted: 'border-muted bg-muted text-muted-foreground',
  open: 'border-destructive/20 bg-destructive/10 text-destructive',
  reviewing: 'border-amber-200 bg-amber-50 text-amber-700',
  resolved: 'border-brand-mint/40 bg-brand-mint/20 text-brand-ink',
  dismissed: 'border-muted bg-muted text-muted-foreground',
};

function targetLabel(report: Report): string {
  if (report.reportedUserId) return `User ${report.reportedName ?? report.reportedUserId}`;
  if (report.topicId) return `Topic ${report.topicId.slice(0, 8)}`;
  if (report.commentId) return `Comment ${report.commentId.slice(0, 8)}`;
  if (report.messageId) return `Message ${report.messageId.slice(0, 8)}`;
  return 'Unknown target';
}

export default function AdminPanel() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const loadAdmin = async () => {
    const result = await apiRequest<{ admin: Admin }>('/v1/admin/auth/me');
    setAdmin(result.admin);
  };

  const loadConsole = async () => {
    const [overviewResult, reportsResult, usersResult] = await Promise.all([
      apiRequest<Overview>('/v1/admin/overview'),
      apiRequest<{ reports: Report[] }>('/v1/admin/reports?status=open'),
      apiRequest<{ users: AdminUser[] }>('/v1/admin/users'),
    ]);
    setOverview(overviewResult);
    setReports(reportsResult.reports);
    setUsers(usersResult.users);
  };

  useEffect(() => {
    loadAdmin()
      .then(loadConsole)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async () => {
    setSubmitting(true);
    try {
      const result = await apiRequest<{ admin: Admin }>('/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAdmin(result.admin);
      setPassword('');
      await loadConsole();
      toast.success('Admin console ready');
    } catch (error) {
      toast.error('Admin login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await apiRequest('/v1/admin/auth/logout', { method: 'POST' });
    setAdmin(null);
  };

  const setReportStatus = async (report: Report, status: 'reviewing' | 'resolved' | 'dismissed') => {
    await apiRequest(`/v1/admin/reports/${report.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolution: status === 'reviewing' ? undefined : 'Reviewed by admin' }),
    });
    toast.success('Report updated');
    await loadConsole();
  };

  const setUserStatus = async (status: 'active' | 'suspended' | 'banned') => {
    if (!selectedUser) return;
    await apiRequest(`/v1/admin/users/${selectedUser.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason: moderationReason || undefined }),
    });
    toast.success('User status updated');
    setModerationReason('');
    await loadConsole();
  };

  if (loading) {
    return (
      <main className="app-shell flex min-h-dvh items-center justify-center p-6">
        <div className="text-sm font-semibold text-muted-foreground">Loading admin console...</div>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className="app-shell flex min-h-dvh items-center justify-center p-6">
        <Card className="w-full max-w-sm border-border shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-white">
                <Shield className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-brand-ink">Admin Console</h1>
                <p className="text-sm font-medium text-muted-foreground">Safety operations for Seoulmate.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(event) => event.key === 'Enter' && login()}
                />
              </div>
              <Button className="action-primary h-11 w-full rounded-xl font-extrabold" disabled={submitting} onClick={login}>
                Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
        <Toaster />
      </main>
    );
  }

  return (
    <main className="app-shell min-h-dvh p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-white">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-brand-ink">Safety Admin</h1>
              <p className="text-sm font-medium text-muted-foreground">{admin.email} · {admin.role}</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={logout}>
            <LogOut className="mr-2 size-4" /> Logout
          </Button>
        </header>

        {overview && (
          <section className="grid gap-3 md:grid-cols-3">
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-muted-foreground">Users</p>
                <p className="mt-2 text-3xl font-extrabold text-brand-ink">{overview.users.total}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {overview.users.suspended} suspended · {overview.users.banned} banned
                </p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-muted-foreground">Open reports</p>
                <p className="mt-2 text-3xl font-extrabold text-brand-coral">{overview.reports.open}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{overview.reports.reviewing} in review</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-muted-foreground">Visible content</p>
                <p className="mt-2 text-3xl font-extrabold text-brand-ink">{overview.content.topics}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {overview.content.comments} comments · {overview.content.messages} messages
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-brand-ink">Reports</h2>
                <Badge variant="outline">{reports.length} open</Badge>
              </div>
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-extrabold text-foreground">{targetLabel(report)}</p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {report.reporterName ?? 'Unknown reporter'} · {parseApiDate(report.createdAt)?.toLocaleString() ?? ''}
                        </p>
                      </div>
                      <Badge className={statusTone[report.status]} variant="outline">{report.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-brand-ink">{report.reason}</p>
                    {report.detail && <p className="mt-1 text-sm leading-6 text-muted-foreground">{report.detail}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setReportStatus(report, 'reviewing')}>Review</Button>
                      <Button size="sm" variant="outline" onClick={() => setReportStatus(report, 'dismissed')}>Dismiss</Button>
                      <Button size="sm" className="bg-brand-ink text-white hover:bg-brand-ink/90" onClick={() => setReportStatus(report, 'resolved')}>
                        <CheckCircle2 className="mr-1 size-4" /> Resolve
                      </Button>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="rounded-2xl border border-border bg-muted/40 p-8 text-center text-sm font-semibold text-muted-foreground">
                    No open reports.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-xl font-extrabold text-brand-ink">Users</h2>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all ${
                      selectedUserId === user.id ? 'border-brand-coral bg-brand-blush' : 'border-border bg-white hover:border-brand-coral/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-foreground">{user.displayName}</p>
                        <p className="truncate text-xs font-semibold text-muted-foreground">{user.email ?? user.id}</p>
                      </div>
                      <Badge className={statusTone[user.safetyStatus]} variant="outline">{user.safetyStatus}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">{user.reportsCount} active reports</p>
                  </button>
                ))}
              </div>

              {selectedUser && (
                <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center gap-2 text-brand-ink">
                    <UserX className="size-4" />
                    <p className="font-extrabold">{selectedUser.displayName}</p>
                  </div>
                  <Textarea
                    value={moderationReason}
                    onChange={(event) => setModerationReason(event.target.value)}
                    placeholder="Reason for moderation action..."
                    className="min-h-20 rounded-xl bg-white"
                  />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => setUserStatus('active')}>Active</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setUserStatus('suspended')}>Suspend</Button>
                    <Button variant="destructive" className="rounded-xl" onClick={() => setUserStatus('banned')}>
                      <AlertTriangle className="mr-1 size-4" /> Ban
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
      <Toaster />
    </main>
  );
}
