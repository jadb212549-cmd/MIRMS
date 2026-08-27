import './polyfill.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
} catch (mountErr) {
  console.error('Fatal initialization error during React root mounting:', mountErr);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height:100vh;background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;font-family:sans-serif;text-align:center;">
        <h2 style="color:#ef4444;margin-bottom:10px;">Startup Error</h2>
        <p style="color:#9ca3af;max-width:500px;font-size:14px;margin-bottom:20px;">
          An error occurred while mounting the application. Please try clearing the local cache or reloading.
        </p>
        <button onclick="localStorage.clear();sessionStorage.clear();window.location.reload();" style="background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;">
          Clear Cache & Reload App
        </button>
      </div>
    `;
  }
}
