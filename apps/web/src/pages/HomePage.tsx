// src/pages/HomePage.tsx
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, DollarSign, Scissors, User, ChevronRight } from "lucide-react";
import { servicesApi, barbersApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Logo } from "@/components/ui/Logo";
import { Button, Badge, SkeletonCard, Spinner } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { Service, BarberProfile } from "@/types";

export function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["services"],
    queryFn: () => servicesApi.list().then((r) => r.data as Service[]),
  });

  const { data: barbers = [], isLoading: loadingBarbers } = useQuery({
    queryKey: ["barbers"],
    queryFn: () => barbersApi.list().then((r) => r.data as BarberProfile[]),
  });

  const handleReserve = (serviceId: string) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/agendar?service=${serviceId}` } });
    } else {
      navigate(`/agendar?service=${serviceId}`);
    }
  };

  return (
    <div className="min-h-dvh bg-dark-500">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-dark-500/95 backdrop-blur-sm border-b border-dark-50">
        <div className="page-container !py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() =>
                  navigate(
                    user?.role === "ADMIN"
                      ? "/admin/dashboard"
                      : user?.role === "BARBER"
                      ? "/barbeiro/dashboard"
                      : "/agendamentos"
                  )
                }
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-500 text-xs font-semibold">
                  {user?.name.charAt(0)}
                </div>
                <span className="hidden sm:inline">{user?.name.split(" ")[0]}</span>
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-[var(--text-secondary)] hover:text-white font-medium transition-colors"
                >
                  Entrar
                </Link>
                <Button size="sm" onClick={() => navigate("/register")}>
                  Criar conta
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="page-container pt-10 pb-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-dark-300 border border-dark-50 flex items-center justify-center">
            <Scissors size={24} className="text-gold-500" />
          </div>
          <div>
            <p className="section-label mb-0.5">Seja bem-vindo ao</p>
            <h1 className="font-display text-2xl font-semibold text-white">
              The House Barber
            </h1>
          </div>
        </div>

        {/* Services */}
        <div className="card overflow-visible">
          <div className="px-5 py-4 border-b border-dark-50">
            <h2 className="font-display font-semibold text-white text-lg">
              Serviços
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Selecione um serviço para agendar
            </p>
          </div>

          <div className="divide-y divide-dark-50">
            {loadingServices ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-5 flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-24" />
                    <div className="skeleton h-3 w-40" />
                  </div>
                  <div className="skeleton h-9 w-28 rounded-xl" />
                </div>
              ))
            ) : (
              services.map((service) => (
                <div
                  key={service.id}
                  className="p-5 flex items-start justify-between gap-4 hover:bg-dark-200/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-base">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-[var(--text-muted)] mt-0.5">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <Clock size={12} className="text-[var(--text-muted)]" />
                        {service.duration}min
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <DollarSign size={12} className="text-[var(--text-muted)]" />
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    icon={<Calendar size={14} />}
                    onClick={() => handleReserve(service.id)}
                    className="shrink-0"
                  >
                    Reservar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Barbers section */}
        {barbers.length > 0 && (
          <div className="mt-6">
            <h2 className="font-display font-semibold text-white text-lg mb-4">
              Nossos Barbeiros
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {barbers.map((barber) => (
                <div key={barber.id} className="card-elevated p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gold-600/15 border border-gold-600/25 flex items-center justify-center text-gold-500 font-display font-semibold text-lg mx-auto mb-2">
                    {barber.user.name.charAt(0)}
                  </div>
                  <p className="text-sm font-medium text-white truncate">
                    {barber.user.name.split(" ")[0]}
                  </p>
                  <Badge variant="green" className="mt-1 text-[10px]">
                    Disponível
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
