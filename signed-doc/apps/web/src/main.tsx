/**
 * Composition root 1 of 2 (PLAN.md §Architecture Slice > apps/web).
 *
 * Mounts the React root and loads the single stylesheet. No provider, no store,
 * no router — `App.tsx` is the only other composition site.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
