import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Briefcase, ExternalLink, KanbanSquare, LayoutDashboard, LogOut, Menu, Users } from "lucide-react";
import { useAuth } from "../auth/context";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/jobs", label: "Jobs", icon: Briefcase, end: false },
  { to: "/app/pipeline", label: "Pipeline", icon: KanbanSquare, end: false },
  { to: "/app/team", label: "Team", icon: Users, end: false },
];

export default function AppLayout() {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/app" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              A
            </span>
            <span className="font-semibold text-slate-900">ATS Lite</span>
          </Link>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setNavOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className={`${navOpen ? "block" : "hidden"} px-3 pb-4 lg:block`}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}

          {organization ? (
            <a
              href={`/careers/${organization.slug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              <ExternalLink size={16} /> Public career page
            </a>
          ) : null}
        </nav>

        <div className="hidden border-t border-slate-200 px-5 py-4 lg:block">
          <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">
            {organization?.name} · {user?.role.toLowerCase()}
          </p>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 text-sm text-slate-500 hover:text-rose-600"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
