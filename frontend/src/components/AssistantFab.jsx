import { Link, useLocation } from 'react-router-dom';

export default function AssistantFab() {
  const location = useLocation();
  if (location.pathname === '/assistant') return null;

  return (
    <Link
      to="/assistant"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-krishi-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-krishi-600/30 transition hover:bg-krishi-700"
      aria-label="Open AI Assistant"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg">🎤</span>
      <span className="hidden sm:inline">AI Assistant</span>
    </Link>
  );
}