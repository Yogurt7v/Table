import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { AuthProvider } from '@/shared/context/AuthContext';
import { OrgProvider } from '@/shared/context/OrgContext';
import { SearchProvider } from '@/shared/context/SearchContext';
import App from './App.tsx';

dayjs.locale('ru');

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-react-table/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="light">
        <DatesProvider settings={{ locale: 'ru' }}>
          <BrowserRouter>
            <AuthProvider>
              <OrgProvider>
                <SearchProvider>
                  <App />
                </SearchProvider>
              </OrgProvider>
            </AuthProvider>
          </BrowserRouter>
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
);
