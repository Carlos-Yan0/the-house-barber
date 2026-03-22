// src/pages/admin/AdminDashboardPage.tsx
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { adminApi, appointmentsApi } from "@/lib/api";
import { StatsCard, Spinner } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { STATUS_CLASSES, STATUS_LABELS, type Appointment } from "@/types";

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: recentApts } = useQuery({
    queryKey: ["admin-recent-apts"],
    queryFn: () =>
      appointmentsApi.list({ limit: 10 }).then((r) => r.data),
  });

  const appointments: Appointment[] = recentApts?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <p className="section-label mb-1">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
        <h1 className="font-display text-2xl font-semibold text-white">
          Dashboard Admin
        </h1>
      </div>

      {/* Hoje */}
      <p className="section-label mb-3">Hoje</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatsCard
          label="Agendamentos"
          value={stats?.today.appointments ?? 0}
        />
        <StatsCard
          label="Comandas abertas"
          value={stats?.today.openComandas ?? 0}
        />
      </div>

      {/* Este mês */}
      <p className="section-label mb-3">Este mês</p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatsCard
          label="Agendamentos"
          value={stats?.month.appointments ?? 0}
        />
        <StatsCard
          label="Receita"
          value={formatCurrency(stats?.month.revenue ?? 0)}
        />
        <StatsCard
          label="Clientes ativos"
          value={stats?.totals.clients ?? 0}
        />
        <StatsCard
          label="Comissões geradas"
          value={formatCurrency(stats?.month.commissions ?? 0)}
        />
      </div>

      {/* Agendamentos recentes */}
      <h2 className="font-display font-semibold text-white mb-4">
        Agendamentos recentes
      </h2>
      <div className="space-y-2">
        {appointments.map((apt) => (
          <div key={apt.id} className="card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {apt.client?.name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {apt.service?.name} · {apt.barberProfile?.user.name}
              </p>
            </div>
            <span className={STATUS_CLASSES[apt.status]}>
              {STATUS_LABELS[apt.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}