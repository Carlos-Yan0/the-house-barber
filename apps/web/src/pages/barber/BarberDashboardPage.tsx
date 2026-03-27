// src/pages/barber/BarberDashboardPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, DollarSign, User } from "lucide-react";
import { appointmentsApi, barbersApi, comandasApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatsCard, Spinner, EmptyState, Modal, Button } from "@/components/ui";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import type { Appointment, PaymentMethod } from "@/types";
import toast from "react-hot-toast";

const WINDOW_SIZE = 7;
const STEP = 7;
const PAST_DAYS = 14;
const FUTURE_DAYS = 21;
const dateRange = Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, i) =>
  addDays(startOfDay(new Date()), i - PAST_DAYS)
);

// ── Timeline constants ────────────────────────────────────────────────────────
const SLOT_HEIGHT = 80;
const LABEL_WIDTH = 52;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "CASH",        label: "Dinheiro", icon: "💵" },
  { value: "PIX",         label: "PIX",      icon: "◈"  },
  { value: "CREDIT_CARD", label: "Crédito",  icon: "💳" },
  { value: "DEBIT_CARD",  label: "Débito",   icon: "💳" },
];

function generateSlots(startHour: number, endHour: number) {
  const slots: { label: string; totalMinutes: number }[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push({ label: `${h}:00`, totalMinutes: h * 60 });
    if (h < endHour) slots.push({ label: `${h}:30`, totalMinutes: h * 60 + 30 });
  }
  return slots;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function AppointmentTimeline({
  appointments,
  onBlockClick,
}: {
  appointments: Appointment[];
  onBlockClick: (apt: Appointment) => void;
}) {
  const startHour = appointments.length
    ? Math.max(0, Math.min(...appointments.map((a) => new Date(a.scheduledAt).getHours())) - 1)
    : 8;
  const endHour = appointments.length
    ? Math.min(23, Math.max(...appointments.map((a) => new Date(a.endsAt).getHours())) + 1)
    : 20;

  const slots = generateSlots(startHour, endHour);
  const startMinutes = startHour * 60;
  const totalMinutes = (endHour - startHour) * 60;
  const totalHeight = (totalMinutes / 30) * SLOT_HEIGHT;

  return (
    <div className="relative overflow-x-hidden" style={{ height: totalHeight + SLOT_HEIGHT }}>
      {/* Grade horária */}
      {slots.map(({ label, totalMinutes: slotMin }) => {
        const top = ((slotMin - startMinutes) / 30) * SLOT_HEIGHT;
        const isFullHour = label.endsWith(":00");
        return (
          <div
            key={label}
            className="absolute w-full flex items-center pointer-events-none"
            style={{ top }}
          >
            <span
              className={cn(
                "text-xs shrink-0 text-right pr-3 select-none",
                isFullHour ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
              )}
              style={{ width: LABEL_WIDTH }}
            >
              {label}
            </span>
            <div
              className={cn(
                "flex-1 border-t",
                isFullHour ? "border-dark-50" : "border-dark-50/40"
              )}
            />
          </div>
        );
      })}

      {/* Blocos de agendamento */}
      {appointments.map((apt) => {
        const aptStart = new Date(apt.scheduledAt);
        const aptEnd = new Date(apt.endsAt);
        const aptStartMin = minutesFromMidnight(aptStart);
        const aptEndMin = minutesFromMidnight(aptEnd);
        const durationMin = aptEndMin - aptStartMin;

        const top = ((aptStartMin - startMinutes) / 30) * SLOT_HEIGHT + 1;
        const height = (durationMin / 30) * SLOT_HEIGHT - 2;

        const isCompleted = apt.status === "COMPLETED";
        const isCancelled = apt.status === "CANCELLED" || apt.status === "NO_SHOW";
        const hasOpenComanda = apt.comanda?.status === "OPEN";
        const isClickable = hasOpenComanda && !isCancelled && !isCompleted;

        return (
          <div
            key={apt.id}
            onClick={() => isClickable && onBlockClick(apt)}
            className={cn(
              "absolute rounded-lg px-3 py-2 overflow-hidden transition-all duration-150",
              isCancelled
                ? "bg-dark-200 border border-dark-50 opacity-50"
                : isCompleted
                ? "bg-emerald-700/60 border border-emerald-600/40"
                : "bg-[#3B5BDB] border border-blue-400/30",
              isClickable && "cursor-pointer hover:brightness-125 active:scale-[0.98] ring-0 hover:ring-2 hover:ring-gold-500/60"
            )}
            style={{
              top,
              height,
              left: LABEL_WIDTH + 8,
              right: 0,
            }}
          >
            {/* Linha 1: horário */}
            <p className="text-xs font-semibold text-white leading-tight truncate">
              {formatTime(apt.scheduledAt)} · {formatTime(apt.endsAt)}
            </p>

            {/* Linha 2: serviço */}
            {apt.service && durationMin >= 20 && (
              <p className="text-[11px] text-blue-100/80 mt-0.5 truncate leading-tight">
                {apt.service.name}
              </p>
            )}

            {/* Linha 3: cliente */}
            {apt.client?.name && durationMin >= 20 && (
              <p className="text-[10px] text-blue-100/70 mt-0.5 leading-tight flex items-center gap-1 truncate">
                <User size={9} className="shrink-0" />
                Cliente: {apt.client.name}
              </p>
            )}

            {/* Linha 4: CTA ou status */}
            {durationMin >= 30 && (
              <p className="text-[10px] text-blue-200/60 mt-0.5 leading-tight">
                {isCancelled
                  ? apt.status === "NO_SHOW"
                    ? "Não compareceu"
                    : "Cancelado"
                  : isCompleted
                  ? `✓ Concluído${apt.service ? ` · ${formatCurrency(apt.service.price)}` : ""}`
                  : hasOpenComanda
                  ? "Toque para fechar comanda →"
                  : "Sem comanda aberta"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export function BarberDashboardPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const barberId = user?.barberProfile?.id;

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [windowStart, setWindowStart] = useState(Math.max(0, PAST_DAYS - 1));

  // Estado do modal de fechar comanda
  const [closeModal, setCloseModal] = useState<string | null>(null); // comandaId
  const [closeApt, setCloseApt] = useState<Appointment | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("CASH");

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
      const end = format(new Date(), "yyyy-MM-dd");
      return barbersApi.getEarnings(barberId!, { startDate: start, endDate: end }).then((r) => r.data);
    },
    enabled: !!barberId,
  });

  const closeMutation = useMutation({
    mutationFn: () => comandasApi.close(closeModal!, selectedPayment),
    onSuccess: () => {
      toast.success("Comanda fechada! Comissão calculada.");
      qc.invalidateQueries({ queryKey: ["barber-appointments", selectedDateStr] });
      qc.invalidateQueries({ queryKey: ["barber-appointments-today"] });
      qc.invalidateQueries({ queryKey: ["barber-comandas-open"] });
      qc.invalidateQueries({ queryKey: ["barber-earnings-month", barberId] });
      setCloseModal(null);
      setCloseApt(null);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Erro ao fechar comanda"),
  });

  const handleBlockClick = (apt: Appointment) => {
    if (!apt.comanda?.id) return;
    setCloseApt(apt);
    setCloseModal(apt.comanda.id);
    setSelectedPayment("CASH");
  };

  // Filtra pelos agendamentos do próprio barbeiro — necessário quando o usuário
  // também é ADMIN, pois nesse caso o backend não aplica filtro por barbeiro.
  const appointments: Appointment[] = (appointmentsData?.data ?? []).filter(
    (a) => !barberId || a.barberProfileId === barberId
  );
  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const pending = appointments.filter((a) => a.status === "PENDING");
  const completed = appointments.filter((a) => a.status === "COMPLETED");

  const visibleDates = dateRange.slice(windowStart, windowStart + WINDOW_SIZE);
  const canGoBack = windowStart > 0;
  const canGoForward = windowStart + WINDOW_SIZE < dateRange.length;
  const dateLabel = isViewingToday
    ? "Hoje"
    : format(selectedDate, "dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="page-container animate-fade-in">
      {/* Cabeçalho */}
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
          label={`Agendamentos — ${dateLabel}`}
          value={loadingAppointments ? "…" : appointments.length}
        />
        <StatsCard label="Concluídos" value={loadingAppointments ? "…" : completed.length} />
        <StatsCard label="Pendentes"  value={loadingAppointments ? "…" : pending.length} />
        <StatsCard
          label="Ganhos no mês"
          value={formatCurrency(earningsData?.totalCommission ?? 0)}
        />
      </div>

      {/* Seletor de data */}
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
              onClick={() =>
                setWindowStart((p) => Math.min(dateRange.length - WINDOW_SIZE, p + STEP))
              }
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
            const key = format(date, "yyyy-MM-dd");
            const isSelected = isSameDay(date, selectedDate);
            const isToday = key === todayStr;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(startOfDay(date))}
                className={cn(
                  "flex flex-col items-center py-2.5 rounded-xl border text-xs transition-all duration-200",
                  isSelected
                    ? "bg-gold-600 border-gold-500 text-white"
                    : isToday
                    ? "bg-dark-200 border-gold-600/40 text-gold-400"
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

      {/* Timeline */}
      <p className="section-label mb-3">
        {dateLabel} —{" "}
        {loadingAppointments
          ? "carregando…"
          : `${appointments.length} agendamento${appointments.length !== 1 ? "s" : ""}`}
      </p>

      {loadingAppointments ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : sortedAppointments.length === 0 ? (
        <EmptyState
          icon={<Calendar size={22} />}
          title={isViewingToday ? "Dia livre!" : "Sem agendamentos"}
          description={
            isViewingToday
              ? "Nenhum agendamento para hoje."
              : "Nenhum agendamento para este dia."
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="p-3 overflow-y-auto" style={{ maxHeight: "65vh" }}>
            <AppointmentTimeline
              appointments={sortedAppointments}
              onBlockClick={handleBlockClick}
            />
          </div>
        </div>
      )}

      {/* Modal: fechar comanda — mesmo fluxo do BarberComandasPage */}
      <Modal
        isOpen={!!closeModal}
        onClose={() => { setCloseModal(null); setCloseApt(null); }}
        title="Fechar comanda"
        size="sm"
      >
        {closeApt && (
          <div className="mb-4 p-3 rounded-xl bg-dark-400 border border-dark-50">
            <p className="text-sm font-medium text-white">{closeApt.client?.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {closeApt.service?.name}
              {closeApt.service && ` · ${formatCurrency(closeApt.service.price)}`}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatTime(closeApt.scheduledAt)} — {formatTime(closeApt.endsAt)}
            </p>
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)] mb-3">
          Selecione como o cliente pagou na barbearia:
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {PAYMENT_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setSelectedPayment(p.value)}
              className={cn(
                "p-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2",
                selectedPayment === p.value
                  ? "bg-gold-600/15 border-gold-600/40 text-gold-400"
                  : "bg-dark-300 border-dark-50 text-[var(--text-secondary)] hover:border-gold-600/20"
              )}
            >
              <span>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>

        <Button
          className="w-full"
          icon={<DollarSign size={14} />}
          loading={closeMutation.isPending}
          onClick={() => closeMutation.mutate()}
        >
          Confirmar pagamento
        </Button>
      </Modal>
    </div>
  );
}