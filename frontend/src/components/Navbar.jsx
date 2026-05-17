import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const dashboardPath = user?.role === 'farmer' ? '/farmer' : '/buyer';

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  const linkBase = 'px-3 py-2 rounded-md text-sm font-medium';
  const linkClasses = ({ isActive }) =>
    `${linkBase} ${isActive ? 'bg-krishi-100 text-krishi-800' : 'text-gray-700 hover:bg-krishi-50'}`;

  return (
    <header className="sticky top-0 z-30 border-b border-krishi-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-krishi-600 text-white">
            🌾
          </span>
          <span className="text-lg font-bold text-krishi-800">Smart Krishi Market</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={linkClasses}>Home</NavLink>
          <NavLink to="/assistant" className={linkClasses}>AI Assistant</NavLink>
          <NavLink to="/market-trends" className={linkClasses}>Market Trends</NavLink>
          {isAuthenticated && (
            <>
              <NavLink to={dashboardPath} className={linkClasses}>Dashboard</NavLink>
              <NavLink to="/logistics" className={linkClasses}>Logistics</NavLink>
              {user?.role === 'buyer' && <NavLink to="/buyer/matches" className={linkClasses}>Matches</NavLink>}
              <NavLink to="/messages" className={linkClasses}>💬 Messages</NavLink>
            </>
          )}
          {isAuthenticated ? (
            <button onClick={handleLogout} className="btn-outline ml-2">Logout</button>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Login</Link>
              <Link to="/register" className="btn-primary">Get Started</Link>
            </>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          aria-label="Toggle menu"
          className="rounded-md p-2 text-gray-700 hover:bg-krishi-50 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-krishi-100 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            <NavLink to="/" end className={linkClasses} onClick={() => setOpen(false)}>Home</NavLink>
            <NavLink to="/assistant" className={linkClasses} onClick={() => setOpen(false)}>AI Assistant</NavLink>
            <NavLink to="/market-trends" className={linkClasses} onClick={() => setOpen(false)}>Market Trends</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to={dashboardPath} className={linkClasses} onClick={() => setOpen(false)}>Dashboard</NavLink>
                <NavLink to="/logistics" className={linkClasses} onClick={() => setOpen(false)}>Logistics</NavLink>
                {user?.role === 'buyer' && (
                  <NavLink to="/buyer/matches" className={linkClasses} onClick={() => setOpen(false)}>Matches</NavLink>
                )}
                <NavLink to="/messages" className={linkClasses} onClick={() => setOpen(false)}>💬 Messages</NavLink>
              </>
            )}
            <div className="pt-2">
              {isAuthenticated ? (
                <button onClick={handleLogout} className="btn-outline w-full">Logout</button>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="btn-outline flex-1" onClick={() => setOpen(false)}>Login</Link>
                  <Link to="/register" className="btn-primary flex-1" onClick={() => setOpen(false)}>Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
