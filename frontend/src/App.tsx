import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptFamilyInvite, getSession } from './api';
import { FeedbackWidget } from './components/FeedbackWidget';
import { readableApiError } from './lib/api-error';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SessionProvider } from './session';

export function App() {
  return (
    <Routes>
      <Route path="/datenschutz" element={<LegalPage kind="privacy" />} />
      <Route path="/impressum" element={<LegalPage kind="imprint" />} />
      <Route path="/" element={<AuthenticatedRoute element={<DashboardPage />} />} />
      <Route path="/onboarding" element={<AuthenticatedRoute element={<OnboardingPage />} />} />
      <Route path="/admin" element={<AuthenticatedRoute element={<AdminPage />} />} />
      <Route path="/family/invites/accept" element={<AuthenticatedRoute element={<AcceptInvitePage />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AcceptInvitePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const mutation = useMutation({
    mutationFn: () => acceptFamilyInvite(token),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['family'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['current-plan'] }),
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
      ]);
      navigate('/onboarding?family=joined', { replace: true });
    },
  });

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="surface invite-accept">
          <span className="eyebrow">Familienkonto</span>
          <h1>Einladung annehmen</h1>
          <p>
            Wenn du diese Einladung annimmst, entfällt dein persönlicher Account als eigener Bereich. Dein Profil wird
            sinnvoll mit dem Familienkonto zusammengeführt.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || token === ''}
          >
            {mutation.isPending ? 'Einladung wird angenommen' : 'Familienkonto beitreten'}
          </button>
          {mutation.isError ? <p className="error-copy">{readableApiError(mutation.error, 'Einladung konnte nicht angenommen werden.')}</p> : null}
        </section>
      </main>
    </div>
  );
}

function AuthenticatedRoute({ element }: { element: ReactElement }) {
  const location = useLocation();
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <section className="inline-banner">
            <div>
              <h2>Session wird geprüft</h2>
              <p>Mealplanner lädt deinen privaten Zugang.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!sessionQuery.data?.authenticated) {
    return <LoginPage />;
  }

  const feedbackEnabledRoutes = new Set(['/', '/onboarding', '/admin']);
  const showFeedback =
    feedbackEnabledRoutes.has(location.pathname) &&
    Boolean(sessionQuery.data?.isPremium || sessionQuery.data?.isAdmin);

  return (
    <SessionProvider session={sessionQuery.data}>
      {element}
      {showFeedback ? <FeedbackWidget /> : null}
    </SessionProvider>
  );
}
