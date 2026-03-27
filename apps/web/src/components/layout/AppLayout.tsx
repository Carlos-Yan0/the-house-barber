// src/components/layout/AppLayout.tsx
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Calendar,
  Scissors,
  User,
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  shortLabel: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  // Client
  { to: "/agendar",      icon: <Scissors size={20} />,       label: "Agendar",       shortLabel: "Agendar",    roles: ["CLIENT", "ADMIN", "BARBER"] },
  { to: "/agendamentos", icon: <Calendar size={20} />,        label: "Meus horários", shortLabel: "Horários",   roles: ["CLIENT"] },
  { to: "/perfil",       icon: <User size={20} />,            label: "Perfil",        shortLabel: "Perfil",     roles: ["CLIENT", "ADMIN", "BARBER"] },

  // Barber
  { to: "/barbeiro/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard",    shortLabel: "Dashboard", roles: ["BARBER"] },
  { to: "/barbeiro/agenda",    icon: <Calendar size={20} />,        label: "Minha Agenda", shortLabel: "Agenda",    roles: ["BARBER", "ADMIN"] },
  { to: "/barbeiro/comandas",  icon: <ClipboardList size={20} />,   label: "Comandas",     shortLabel: "Comandas",  roles: ["BARBER", "ADMIN"] },
  { to: "/barbeiro/ganhos",    icon: <TrendingUp size={20} />,      label: "Ganhos",       shortLabel: "Ganhos",    roles: ["BARBER"] },

  // Admin
  { to: "/admin/dashboard",  icon: <LayoutDashboard size={20} />, label: "Dashboard",  shortLabel: "Dashboard", roles: ["ADMIN"] },
  { to: "/admin/servicos",   icon: <Scissors size={20} />,        label: "Serviços",   shortLabel: "Serviços",  roles: ["ADMIN"] },
  { to: "/admin/barbeiros",  icon: <Users size={20} />,            label: "Barbeiros",  shortLabel: "Barbeiros", roles: ["ADMIN"] },
  { to: "/admin/relatorios", icon: <BarChart3 size={20} />,        label: "Relatórios", shortLabel: "Relatórios",roles: ["ADMIN"] },
];

const BOTTOM_NAV_HEIGHT = "4rem";

const BOTTOM_NAV_BY_ROLE: Record<string, string[]> = {
  CLIENT: ["/agendar", "/agendamentos", "/perfil"],
  BARBER: ["/barbeiro/dashboard", "/barbeiro/agenda", "/barbeiro/comandas", "/barbeiro/ganhos", "/perfil"],
};

export function AppLayout() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const userNav = NAV_ITEMS.filter((n) =>
    user ? n.roles.includes(user.role) : false
  );

  const bottomNavPaths = user ? (BOTTOM_NAV_BY_ROLE[user.role] ?? []) : [];
  const bottomNav = userNav.filter(item => bottomNavPaths.includes(item.to));

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Ignore logout API errors — we still clear local state.
    }
    logout();
    navigate("/login");
    toast.success("Até logo!");
  };

  // ── Sidebar compartilhada (desktop sempre visível, mobile só para ADMIN) ──
  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-dark-50">
        <Logo />
      </div>

      <div className="px-4 py-4 border-b border-dark-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 font-display font-semibold text-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {user?.role === "ADMIN"
                ? "Administrador"
                : user?.role === "BARBER"
                ? "Barbeiro"
                : "Cliente"}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {userNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                  isActive
                    ? "bg-gold-600/15 text-gold-400 border border-gold-600/20"
                    : "text-[var(--text-secondary)] hover:text-white hover:bg-dark-50/50"
                )
              }
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-dark-50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-dark-500 flex">

      {/* ── Desktop Sidebar (sempre visível) ── */}
      <aside className="hidden md:flex flex-col w-64 bg-dark-400 border-r border-dark-50 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar (só ADMIN) ── */}
      {isAdmin && (
        <>
          {/* Overlay */}
          {mobileSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* Drawer */}
          <aside
            className={cn(
              "md:hidden fixed top-0 left-0 h-full w-72 z-40 flex flex-col bg-dark-400 border-r border-dark-50 transition-transform duration-300",
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-50">
              <Logo />
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-dark-50/60 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 border-b border-dark-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 font-display font-semibold text-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Administrador</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <div className="space-y-1">
                {userNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                        isActive
                          ? "bg-gold-600/15 text-gold-400 border border-gold-600/20"
                          : "text-[var(--text-secondary)] hover:text-white hover:bg-dark-50/50"
                      )
                    }
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="p-4 border-t border-dark-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-dvh">

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-10 bg-dark-400/95 backdrop-blur-sm border-b border-dark-50 px-4 py-3 flex items-center justify-between">
          {isAdmin ? (
            <>
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-dark-50/60 transition-all"
              >
                <Menu size={22} />
              </button>
              <Logo />
              <div className="w-8 h-8 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 font-display text-xs font-semibold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
            </>
          ) : (
            <>
              <Logo />
              <div className="w-8 h-8 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 font-display text-xs font-semibold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
            </>
          )}
        </header>

        <div
          className={cn(
            "flex-1 overflow-auto",
            !isAdmin && "md:pb-0"
          )}
          style={
            !isAdmin
              ? { paddingBottom: `calc(${BOTTOM_NAV_HEIGHT} + env(safe-area-inset-bottom, 0px))` }
              : undefined
          }
        >
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation — apenas para não-admin */}
        {!isAdmin && (
          <nav className="md:hidden sticky bottom-0 z-10 bg-dark-400/95 backdrop-blur-sm border-t border-dark-50 pb-safe">
            <div className="flex h-16">
              {bottomNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 px-1",
                      isActive
                        ? "text-gold-400"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    )
                  }
                >
                  {item.icon}
                  <span className="text-[10px] font-medium leading-none text-center w-full truncate">
                    {item.shortLabel}
                  </span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}