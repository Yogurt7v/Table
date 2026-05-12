import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout.tsx';
import { RequireAuth } from '@/shared/components/RequireAuth';
import { MainPage } from './pages/MainPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
