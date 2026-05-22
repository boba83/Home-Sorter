import './App.css'
import ExcursionCalculator from './pages/ExcursionCalculator';
import Landing from './pages/Landing';
import ImportantInfo from './pages/ImportantInfo';
import TaskManager from './pages/TaskManager';
import DezurstvaPlanPage from './dezurstva/DezurstvaPlanPage';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, Link } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { getToken } from '@/api/client';
import ErrorBoundary from '@/lib/ErrorBoundary';
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { authReady, isLoadingAuth, isAuthenticated } = useAuth();

  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  if (!authReady || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Provera sesije…</p>
        <Link to="/login" className="text-sm text-blue-600 hover:underline">
          Idi na prijavu
        </Link>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/ExcursionCalculator" element={<LayoutWrapper currentPageName="ExcursionCalculator"><ExcursionCalculator /></LayoutWrapper>} />
      <Route path="/Landing" element={<LayoutWrapper currentPageName="Landing"><Landing /></LayoutWrapper>} />
      <Route path="/ImportantInfo" element={<LayoutWrapper currentPageName="ImportantInfo"><ImportantInfo /></LayoutWrapper>} />
      <Route path="/TaskManager" element={<LayoutWrapper currentPageName="TaskManager"><TaskManager /></LayoutWrapper>} />
      <Route path="/Dezurstva" element={<LayoutWrapper currentPageName="Dezurstva"><DezurstvaPlanPage /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
