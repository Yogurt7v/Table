import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader } from '@mantine/core';
import { AppLayout } from './layouts/AppLayout.tsx';
import { RequireAuth } from '@/shared/components/RequireAuth';
import { MainPage } from './pages/MainPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';

const MailPage = lazy(() => import('./pages/MailPage').then((mod) => ({ default: mod.MailPage })));
const DocsPage = lazy(() => import('./pages/DocsPage').then((mod) => ({ default: mod.DocsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((mod) => ({ default: mod.AdminPage })));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/mail" element={
            <Suspense fallback={<Loader size="sm" />}>
              <MailPage />
            </Suspense>
          } />
          <Route path="/docs" element={
            <Suspense fallback={<Loader size="sm" />}>
              <DocsPage />
            </Suspense>
          } />
          <Route path="/admin" element={
            <Suspense fallback={<Loader size="sm" />}>
              <AdminPage />
            </Suspense>
          } />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
