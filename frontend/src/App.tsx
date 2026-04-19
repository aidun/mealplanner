import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSession } from './api';
import { DashboardPage } from './pages/DashboardPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';

export function App() {
  return (
    <Routes>
      <Route path="/datenschutz" element={<LegalPage kind="privacy" />} />
      <Route path="/impressum" element={<LegalPage kind="imprint" />} />
      <Route path="/" element={<AuthenticatedRoute element={<DashboardPage />} />} />
      <Route path="/onboarding" element={<AuthenticatedRoute element={<OnboardingPage />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthenticatedRoute({ element }: { element: ReactElement }) {
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

  return element;
}
