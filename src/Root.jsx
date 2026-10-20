import { lazy, Suspense } from 'react';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { GLOBAL_CSS } from './styles/global.js';
import { tokenFromPath } from './lib/publicSop.js';
import SharedSopPage from './components/SharedSopPage.jsx';

// The signed-in app is loaded only when it is needed, so a worker opening a SOP link never starts the sign-in code.
const App = lazy(() => import('./App.jsx'));

/** A SOP link (/s/<token>) opens the worker's page; anything else opens the app. */
export default function Root({ pathname = window.location.pathname }) {
  const token = tokenFromPath(pathname);
  if (token) {
    return (
      <LanguageProvider>
        <style>{GLOBAL_CSS}</style>
        <SharedSopPage token={token} />
      </LanguageProvider>
    );
  }
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
