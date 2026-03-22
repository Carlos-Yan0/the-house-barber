// src/pages/barber/BarberDashboardPage.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, DollarSign, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { appointmentsApi, barbersApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatsCard, Spinner, EmptyState } from "@/components/ui";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_CLASSES, type Appointment } from "@/types";

const WINDOW_SIZE = 7;
const STEP = 7;
const PAST_DAYS = 14;
const FUTURE_DAYS = 21;
const dateRange = Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, i) =>
  addDays(startOfDay(new Date()), i - PAST_DAYS)
);

export function BarberDashboardPage() {
  const { user } = useAuthStore();
  const barberId = user?.barberProfile?.id;

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [windowStart, setWindowStart] = useState(Math.max(0, PAST_DAYS - 1));

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isViewingToday = selectedDateStr === todayStr;

  const { data: appointmentsData, isLoading: loadingAppointments } = useQuery({
    queryKey: ["barber-appointments", selectedDateStr],
    queryFn: () =>
      appointmentsApi.list({ date: selectedDateStr, limit: 50 }).then((r) => r.data),
    enabled: !!barberId,
  });

  const { data: earningsData } = useQuery({
    queryKey: ["barber-earnings-month", barberId],
    queryFn: () => {
      const start = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
      const end   = format(new Date(), "yyyy-MM-dd");
      return barbersApi.getEarnings(barberId!, { startDate: start, endDate: end }).then((r) => r.data);
    },
    enabled: !!barberId,
  });

  const appointments: Appointment[] = appointmentsData?.data ?? [];

  // Fluxo novo: só PENDING é "aguardando atendimento"
  const pending   = appointments.filter((a) => a.status === "PENDING");
  const completed = appointments.filter((a) => a.status === "COMPLETED");

  const visibleDates = dateRange.slice(windowStart, windowStart + WINDOW_SIZE);
  const canGoBack    = windowStart > 0;
  const canGoForward = windowStart + WINDOW_SIZE < dateRange.length;
  const dateLabel    = isViewingToday
    ? "Hoje"
    : format(selectedDate, "dd 'de' MMMM", { locale: ptBR });

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

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatsCard
          label={`Agendamentos — ${dateLabel}`}
          value={loadingAppointments ? "…" : appointments.length}
        />
        <StatsCard
          label="Concluídos"
          value={loadingAppointments ? "…" : completed.length}
        />
        <StatsCard
          label="Pendentes"
          value={loadingAppointments ? "…" : pending.length}
        />
        <StatsCard
          label="Ganhos no mês"
          value={formatCurrency(earningsData?.totalCommission ?? 0)}
        />
      </div>

      {/* Date strip */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-white">Agenda</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setWindowStart((p) => Math.max(0, p - STEP))}
              disabled={!canGoBack}
              aria-label="Ver dias anteriores"
              className="p-1.5 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
            </button>
            <button
              onClick={() => setWindowStart((p) => Math.min(dateRange.length - WINDOW_SIZE, p + STEP))}
              disabled={!canGoForward}
              aria-label="Ver próximos dias"
              className="p-1.5 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all"
            >
              <ChevronRight size={16} className="text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {visibleDates.map((date) => {
            const key        = format(date, "yyyy-MM-dd");
            const isSelected = isSameDay(date, selectedDate);
            const isToday    = key === todayStr;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(startOfDay(date))}
                className={cn(
                  "flex flex-col items-center py-2.5 rounded-xl border text-xs transition-all duration-200",
                  isSelected ? "bg-gold-600 border-gold-500 text-white"
                  : isToday  ? "bg-dark-200 border-gold-600/40 text-gold-400"
                  : "bg-dark-300 border-dark-50 text-[var(--text-secondary)] hover:border-gold-600/30"
                )}
              >
                <span className="text-[10px] opacity-70">
                  {format(date, "EEE", { locale: ptBR }).slice(0, 3).toUpperCase()}
                </span>
                <span className="font-semibold">{format(date, "d")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="section-label mb-3">
        {dateLabel} —{" "}
        {loadingAppointments
          ? "carregando…"
          : `${appointments.length} agendamento${appointments.length !== 1 ? "s" : ""}`}
      </p>

      {loadingAppointments ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Calendar size={22} />}
          title={isViewingToday ? "Dia livre!" : "Sem agendamentos"}
          description={isViewingToday ? "Nenhum agendamento para hoje." : "Nenhum agendamento para este dia."}
        />
      ) : (
        <div className="space-y-3">
          {[...appointments]
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
            .map((apt) => (
              <div key={apt.id} className="card-elevated p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{apt.client?.name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{apt.service?.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-2">
                      <Clock size={11} />
                      {formatTime(apt.scheduledAt)} — {formatTime(apt.endsAt)}
                    </div>
                  </div>
                  <span className={STATUS_CLASSES[apt.status]}>
                    {STATUS_LABELS[apt.status]}
                  </span>
                </div>

                {apt.service && (
                  <div className="mt-3 pt-3 border-t border-dark-50 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Valor do serviço</span>
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
  );
}