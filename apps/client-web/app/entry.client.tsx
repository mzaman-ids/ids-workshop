/**
 * By default, React Router will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx react-router reveal` ✨
 * For more information, see https://reactrouter.com/explanation/special-files#entryclienttsx
 */

import {StrictMode, startTransition} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import {HydratedRouter} from 'react-router/dom';
import {createRouterContext} from './core/middleware/routerContext';
import i18n from './i18n';

// Prevent tree-shaking of i18n initialization
if (!i18n.isInitialized && !i18n.isInitializing) {
  console.warn('i18n not initialized for client hydration');
}

if (import.meta.env['VITE_ENABLE_IDS_DOCTOR'] === 'true') {
  void import('./components/doctor/doctor-sdk').then(({initialize}) => initialize());

  const doctorRoot = document.createElement('div');
  doctorRoot.id = 'ids-doctor-root';
  document.body.appendChild(doctorRoot);

  void import('./components/doctor/DoctorPanel').then(({DoctorPanel}) => {
    createRoot(doctorRoot).render(<DoctorPanel />);
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter getContext={createRouterContext} />
    </StrictMode>,
  );
});
