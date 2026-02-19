import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase";

// Pages (make sure these paths exist)
import NGOs from "./pages/Orgs";
import NewReceipt from "./pages/NewReceipt";
import History from "./pages/History";
import Settings from "./pages/Settings";

function cls(active) {
  return active ? "navlink active" : "navlink";
}

function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ margin: 0 }}>Loading…</h2>
        <div className="muted" style={{ marginTop: 8 }}>
          Checking login
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return children;
}

function Login() {
  const [busy, setBusy] = useState(false);

  async function signInGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) alert(error.message);
  }

  return (
    <div style={{ padding: 20, maxWidth: 560 }}>
      <h1 style={{ marginTop: 0 }}>NGO Receipt Generator</h1>
      <p className="muted">
        Sign in to create receipts, keep history, and manage NGO logos.
      </p>

      <button className="btn primary" onClick={signInGoogle} disabled={busy}>
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
    </div>
  );
}

function Layout({ userEmail }) {
  const location = useLocation();

  async function signOut() {
    await supabase.auth.signOut();
  }

  const navItems = [
    { to: "/ngos", label: "NGOs" },
    { to: "/new", label: "New Receipt" },
    { to: "/history", label: "History" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <div className="appShell">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">Receipt Gen</div>

        <nav className="topnav">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cls(isActive)}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="topRight">
          <div className="email">{userEmail}</div>
          <button className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Page */}
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/new" replace />} />
          <Route path="/ngos" element={<NGOs />} />
          <Route path="/new" element={<NewReceipt />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/new" replace />} />
        </Routes>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottomnav">
        {navItems.map((n) => {
          const active = location.pathname === n.to;
          return (
            <NavLink key={n.to} to={n.to} className={active ? "bottomlink active" : "bottomlink"}>
              {n.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Simple styling built-in (works even if you don’t have CSS yet) */}
      <style>{`
        .appShell { min-height: 100vh; background: #f6f7fb; }
        .topbar {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; gap: 14px;
          padding: 10px 12px;
          background: #ffffff; border-bottom: 1px solid #e6e8ef;
        }
        .brand { font-weight: 800; letter-spacing: 0.2px; }
        .topnav { display: flex; gap: 10px; flex: 1; }
        .navlink {
          padding: 8px 10px; border-radius: 10px;
          text-decoration: none; color: #111827;
          background: transparent;
        }
        .navlink.active { background: #eef2ff; color: #1f2a99; }
        .topRight { display: flex; align-items: center; gap: 10px; }
        .email { font-size: 12px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .page { padding: 14px; padding-bottom: 80px; }

        .btn {
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 600;
        }
        .btn.primary {
          background: #111827; color: #fff; border-color: #111827;
        }
        .muted { color: #6b7280; }

        /* Bottom nav for mobile */
        .bottomnav {
          position: fixed; left: 0; right: 0; bottom: 0;
          display: none;
          background: #ffffff;
          border-top: 1px solid #e6e8ef;
          padding: 10px;
          gap: 8px;
        }
        .bottomlink {
          flex: 1;
          text-align: center;
          text-decoration: none;
          color: #111827;
          padding: 10px 8px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-weight: 700;
          font-size: 12px;
        }
        .bottomlink.active {
          background: #111827;
          color: #fff;
          border-color: #111827;
        }

        /* On small screens, hide top nav and show bottom nav */
        @media (max-width: 720px) {
          .topnav { display: none; }
          .email { display: none; }
          .bottomnav { display: flex; }
          .page { padding-bottom: 100px; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || "");
    });
  }, []);

  return (
    <AuthGate>
      <Layout userEmail={email} />
    </AuthGate>
  );
}
