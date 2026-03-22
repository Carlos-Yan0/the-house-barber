// src/App.tsx
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui";

// Layouts — carregados imediatamente (pequenos, necessários para qualquer rota)
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";

// ── Lazy imports — cada página vira um chunk separado no build ───────────────
// O browser só baixa o JS da página quando o usuário navega até ela.
// Páginas de admin (~4 chunks) nunca são baixadas por clientes e barbeiros.

// Public
const HomePage       = lazy(() => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const LoginPage      = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage   = lazy(() => import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));

// Client
const BookingPage      = lazy(() => import("@/pages/BookingPage").then((m) => ({ default: m.BookingPage })));
const AppointmentsPage = lazy(() => import("@/pages/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage })));
const ProfilePage      = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));

// Barber
const BarberDashboardPage = lazy(() => import("@/pages/barber/BarberDashboardPage").then((m) => ({ default: m.BarberDashboardPage })));
const BarberSchedulePage  = lazy(() => import("@/pages/barber/BarberSchedulePage").then((m) => ({ default: m.BarberSchedulePage })));
const BarberComandasPage  = lazy(() => import("@/pages/barber/BarberComandasPage").then((m) => ({ default: m.BarberComandasPage })));
const BarberEarningsPage  = lazy(() => import("@/pages/barber/BarberEarningsPage").then((m) => ({ default: m.BarberEarningsPage })));

// Admin
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminServicesPage  = lazy(() => import("@/pages/admin/AdminServicesPage").then((m) => ({ default: m.AdminServicesPage })));
const AdminBarbersPage   = lazy(() => import("@/pages/admin/AdminBarbersPage").then((m) => ({ default: m.AdminBarbersPage })));
const AdminReportsPage   = lazy(() => import("@/pages/admin/AdminReportsPage").then((m) => ({ default: m.AdminReportsPage })));

import { useAuthInit } from "@/hooks/useAuthInit";

// ── Fallback de carregamento ──────────────────────────────────────────────────
// Exibido enquanto o chunk da página está sendo baixado.
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size={28} />
    </div>
  );
}

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  useAuthInit();

  return (
    // Suspense envolve TODAS as rotas — quando qualquer chunk lazy ainda está
    // carregando o PageLoader é exibido no lugar da rota.
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/"         element={<HomePage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Client */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/agendar"      element={<BookingPage />} />
          <Route path="/agendamentos" element={<AppointmentsPage />} />
          <Route path="/perfil"       element={<ProfilePage />} />
        </Route>

        {/* Barber */}
        <Route element={<ProtectedRoute roles={["BARBER", "ADMIN"]}><AppLayout /></ProtectedRoute>}>
          <Route path="/barbeiro/dashboard" element={<BarberDashboardPage />} />
          <Route path="/barbeiro/agenda"    element={<BarberSchedulePage />} />
          <Route path="/barbeiro/comandas"  element={<BarberComandasPage />} />
          <Route path="/barbeiro/ganhos"    element={<BarberEarningsPage />} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute roles={["ADMIN"]}><AppLayout /></ProtectedRoute>}>
          <Route path="/admin/dashboard"  element={<AdminDashboardPage />} />
          <Route path="/admin/servicos"   element={<AdminServicesPage />} />
          <Route path="/admin/barbeiros"  element={<AdminBarbersPage />} />
          <Route path="/admin/relatorios" element={<AdminReportsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}