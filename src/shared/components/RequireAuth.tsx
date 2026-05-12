import { Navigate, Outlet } from 'react-router-dom';
import { Loader } from '@mantine/core';
import { useAuth } from '@/shared/context/AuthContext';

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
