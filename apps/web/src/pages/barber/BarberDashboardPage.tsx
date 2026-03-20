// src/pages/barber/BarberDashboardPage.tsx
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, DollarSign, TrendingUp } from "lucide-react";
import { appointmentsApi, barbersApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatsCard, Spinner, EmptyState } from "@/components/ui";
import { formatCurrency, formatTime } from "@/lib/utils";
import { STATUS_LABELS, STATUS_CLASSES, type Appointment } from "@/types";

export function BarberDashboardPage() {
  const { user } = useAuthStore();
  const barberId = user?.barberProfile?.id;

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayData, isLoading } = useQuery({
    queryKey: ["barber-today", today],
    queryFn: () =>
      appointmentsApi
        .list({ date: today, limit: 50 })
        .then((r) => r.data),
    enabled: !!barberId,
  });

  const { data: earningsData } = useQuery({
    queryKey: ["barber-earnings", barberId],
    queryFn: () => {
      const start = format(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        "yyyy-MM-dd"
      );
      const end = format(new Date(), "yyyy-MM-dd");
      return barbersApi
        .getEarnings(barberId!, { startDate: start, endDate: end })
        .then((r) => r.data);
    },
    enabled: !!barberId,
  });

  const appointments: Appointment[] = todayData?.data ?? [];
  const pending = appointments.filter(
    (a) => a.status === "PENDING" || a.status === "CONFIRMED"
  );
  const completed = appointments.filter((a) => a.status === "COMPLETED");

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <p className="section-label mb-1">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
        <h1 className="font-display text-2xl font-semibold text-white">
          Olá, {user?.name.split(" ")[0]} 👋
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatsCard
          label="Agendamentos hoje"
          value={appointments.length}
          icon={<Calendar size={16} />}
        />
        <StatsCard
          label="Concluídos hoje"
          value={completed.length}
          icon={<Clock size={16} />}
        />
        <StatsCard
          label="Pendentes"
          value={pending.length}
          icon={<TrendingUp size={16} />}
        />
        <StatsCard
          label="Ganhos no mês"
          value={formatCurrency(earningsData?.totalCommission ?? 0)}
          icon={<DollarSign size={16} />}
        />
      </div>

      {/* Today's schedule */}
      <div>
        <h2 className="font-display font-semibold text-white mb-4">
          Agenda de hoje
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<Calendar size={22} />}
            title="Dia livre!"
            description="Nenhum agendamento para hoje."
          />
        ) : (
          <div className="space-y-3">
            {appointments
              .sort(
                (a, b) =>
                  new Date(a.scheduledAt).getTime() -
                  new Date(b.scheduledAt).getTime()
              )
              .map((apt) => (
                <div key={apt.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white text-sm">
                        {apt.client?.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {apt.service?.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-2">
                        <Clock size={11} />
                        {formatTime(apt.scheduledAt)} —{" "}
                        {formatTime(apt.endsAt)}
                      </div>
                    </div>
                    <span className={STATUS_CLASSES[apt.status]}>
                      {STATUS_LABELS[apt.status]}
                    </span>
                  </div>
                  {apt.service && (
                    <div className="mt-3 pt-3 border-t border-dark-50 flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">
                        Valor do serviço
                      </span>
                      <span className="text-sm font-medium text-gold-400">
                        {formatCurrency(apt.service.price)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
