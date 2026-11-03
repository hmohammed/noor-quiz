import { createBrowserRouter } from 'react-router';
import { HomePage } from './features/home/HomePage';
import { AppLayout } from './features/layout/AppLayout';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { PRIVACY_PATH } from './features/privacy/policy';
import { ProfilePage } from './features/profile/ProfilePage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: PRIVACY_PATH, element: <PrivacyPage /> },
    ],
  },
]);
