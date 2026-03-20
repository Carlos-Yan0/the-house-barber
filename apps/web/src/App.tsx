// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
// src/App.tsx from "@/store/authStore";

// Layouts
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { BookingPage } from "@/pages/BookingPage";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { ProfilePage } from "@/pages/ProfilePage";

// Barber pages
import { BarberDashboardPage } from "@/pages/barber/BarberDashboardPage";
import { BarberSchedulePage } from "@/pages/barber/BarberSchedulePage";
import { BarberComandasPage } from "@/pages/barber/BarberComandasPage";
import { BarberEarningsPage } from "@/pages/barber/BarberEarningsPage";

// Admin pages
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminServicesPage } from "@/pages/admin/AdminServicesPage";
import { AdminBarbersPage } from "@/pages/admin/AdminBarbersPage";
import { AdminReportsPage } from "@/pages/admin/AdminReportsPage";
import { useAuthInit } from "@/hooks/useAuthInit";

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  useAuthInit();
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Client routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/agendar" element={<BookingPage />} />
        <Route path="/agendamentos" element={<AppointmentsPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
      </Route>

      {/* Barber routes */}
      <Route
        element={
          <ProtectedRoute roles={["BARBER", "ADMIN"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/barbeiro/dashboard" element={<BarberDashboardPage />} />
        <Route path="/barbeiro/agenda" element={<BarberSchedulePage />} />
        <Route path="/barbeiro/comandas" element={<BarberComandasPage />} />
        <Route path="/barbeiro/ganhos" element={<BarberEarningsPage />} />
      </Route>

      {/* Admin routes */}
      <Route
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/servicos" element={<AdminServicesPage />} />
        <Route path="/admin/barbeiros" element={<AdminBarbersPage />} />
        <Route path="/admin/relatorios" element={<AdminReportsPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}