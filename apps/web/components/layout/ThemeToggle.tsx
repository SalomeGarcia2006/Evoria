'use client';

import { useSyncExternalStore } from 'react';

const eventName = 'evoria-theme-change';

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'evoria-theme') return;
    document.documentElement.dataset.theme =
      event.newValue === 'dark' || event.newValue === 'light'
        ? event.newValue
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    callback();
  };
  window.addEventListener(eventName, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener('storage', onStorage);
  };
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light');
  const dark = theme === 'dark';

  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('evoria-theme', next);
    } catch {
      // The current page still changes theme if storage is unavailable.
    }
    window.dispatchEvent(new Event(eventName));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className="grid size-10 shrink-0 place-items-center rounded-full border border-sky-blue bg-white text-navy transition hover:border-teal"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {dark ? '☀' : '☾'}
      </span>
    </button>
  );
}
