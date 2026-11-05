import { createBrowserRouter } from 'react-router';
import { CommunitiesPage } from './features/communities/CommunitiesPage';
import { HomePage } from './features/home/HomePage';
import { JoinPage } from './features/invites/JoinPage';
import { AppLayout } from './features/layout/AppLayout';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { PRIVACY_PATH } from './features/privacy/policy';
import { ProfilePage } from './features/profile/ProfilePage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/communities', element: <CommunitiesPage /> },
      { path: '/join/:token', element: <JoinPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: PRIVACY_PATH, element: <PrivacyPage /> },
    ],
  },
]);
