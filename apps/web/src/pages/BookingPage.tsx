// src/pages/BookingPage.tsx
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Clock, DollarSign,
  User, Calendar, Check, Scissors, Banknote, QrCode,
} from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { servicesApi, barbersApi, appointmentsApi } from "@/lib/api";
import { Button, Spinner, EmptyState } from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";
import type { Service, BarberProfile } from "@/types";
import toast from "react-hot-toast";

type Step = "service" | "barber" | "datetime" | "confirm";
type PaymentMethod = "CASH" | "PIX";

const BRT_OFFSET = "-03:00";

const STEPS: { key: Step; label: string; shortLabel: string }[] = [
  { key: "service",  label: "Serviço",   shortLabel: "Serviço"   },
  { key: "barber",   label: "Barbeiro",  shortLabel: "Barbeiro"  },
  { key: "datetime", label: "Data/Hora", shortLabel: "Horário"   },
  { key: "confirm",  label: "Confirmar", shortLabel: "Confirmar" },
];

// ── StepIndicator extracted as a pure memoized component ─────────────────────
// Previously defined inline inside BookingPage, causing a full re-mount
// (including DOM diff of all step nodes) on every keystroke / state change.
interface StepIndicatorProps {
  stepIndex: number;
}

const StepIndicator = memo(function StepIndicator({ stepIndex }: StepIndicatorProps) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => {
        const isDone    = i < stepIndex;
        const isCurrent = i === stepIndex;
        return (
          <div key={s.key} className={cn("flex items-center", i < STEPS.length - 1 ? "flex-1" : "")}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all shrink-0",
                isDone    ? "bg-gold-600 text-white"
                : isCurrent ? "bg-gold-600/20 border border-gold-600 text-gold-400"
                : "bg-dark-200 border border-dark-50 text-[var(--text-muted)]"
              )}>
                {isDone ? <Check size={11} /> : i + 1}
              </div>
              <span className={cn(
                "text-xs font-medium whitespace-nowrap transition-all",
                isCurrent ? "text-white"
                : isDone  ? "text-gold-600 hidden sm:inline"
                : "text-[var(--text-muted)] hidden sm:inline"
              )}>
                {s.shortLabel}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-px mx-2 transition-all", isDone ? "bg-gold-600/50" : "bg-dark-50")} />
            )}
          </div>
        );
      })}
    </div>
  );
});

// Pre-compute the 14-day window once at module level — it never changes within
// a session and was previously recalculated on every render via Array.from().
const DATE_OPTIONS = Array.from({ length: 14 }, (_, i) =>
  addDays(startOfDay(new Date()), i)
);

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("service");
  const [selectedService,  setSelectedService]  = useState<Service | null>(null);
  const [selectedBarber,   setSelectedBarber]   = useState<BarberProfile | null>(null);
  const [selectedDate,     setSelectedDate]     = useState<Date>(startOfDay(new Date()));
  const [selectedTime,     setSelectedTime]     = useState<string | null>(null);
  const [paymentMethod,    setPaymentMethod]    = useState<PaymentMethod>("CASH");
  const [notes,            setNotes]            = useState("");
  const [calendarOffset,   setCalendarOffset]   = useState(0);

  // Derived values — memoized so child renders don't recompute them.
  const stepIndex = useMemo(
    () => STEPS.findIndex((s) => s.key === step),
    [step]
  );

  const visibleDates = useMemo(
    () => DATE_OPTIONS.slice(calendarOffset, calendarOffset + 7),
    [calendarOffset]
  );

  const selectedDateStr = useMemo(
    () => format(selectedDate, "yyyy-MM-dd"),
    [selectedDate]
  );

  // ── Stable callbacks ──────────────────────────────────────────────────────
  const handleSelectService = useCallback((service: Service) => {
    setSelectedService(service);
    setStep("barber");
  }, []);

  const handleSelectBarber = useCallback((barber: BarberProfile) => {
    setSelectedBarber(barber);
    setStep("datetime");
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["services"],
    queryFn: () => servicesApi.list().then((r) => r.data as Service[]),
  });

  const { data: barbers = [], isLoading: loadingBarbers } = useQuery({
    queryKey: ["barbers"],
    queryFn: () => barbersApi.list().then((r) => r.data as BarberProfile[]),
    enabled: step === "barber",
  });

  const { data: availability, isLoading: loadingSlots } = useQuery({
    queryKey: ["availability", selectedBarber?.id, selectedDateStr, selectedService?.id],
    queryFn: () =>
      appointmentsApi
        .getAvailability(selectedBarber!.id, selectedDateStr, selectedService!.id)
        .then((r) => r.data),
    enabled: step === "datetime" && !!selectedBarber && !!selectedService,
  });

  const bookMutation = useMutation({
    mutationFn: () => {
      const scheduledAt = new Date(
        `${selectedDateStr}T${selectedTime!}:00${BRT_OFFSET}`
      ).toISOString();

      return appointmentsApi.create({
        barberProfileId: selectedBarber!.id,
        serviceId:       selectedService!.id,
        scheduledAt,
        paymentMethod,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento realizado! Pague na barbearia.");
      navigate("/agendamentos");
    },
    onError: (err: any) => {
      const message = err.response?.data?.error ?? "Erro ao agendar";
      toast.error(message);
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["availability"] });
        setSelectedTime(null);
        setStep("datetime");
      }
    },
  });

  // Pre-select service from URL query param.
  useEffect(() => {
    const serviceId = searchParams.get("service");
    if (serviceId && services.length > 0) {
      const found = services.find((s) => s.id === serviceId);
      if (found) { setSelectedService(found); setStep("barber"); }
    }
  }, [searchParams, services]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Novo Agendamento</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Escolha um serviço e horário disponível</p>
      </div>

      <StepIndicator stepIndex={stepIndex} />

      {/* ── STEP 1: Serviço ── */}
      {step === "service" && (
        <div className="animate-slide-up">
          <h2 className="text-base font-medium text-white mb-4">Qual serviço você deseja?</h2>
          {loadingServices ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all duration-200",
                    selectedService?.id === service.id
                      ? "bg-gold-600/10 border-gold-600/40"
                      : "bg-dark-300 border-dark-50 hover:border-gold-600/30 hover:bg-dark-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{service.name}</p>
                      {service.description && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{service.description}</p>
                      )}
                      <div className="flex gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Clock size={11} /> {service.duration}min
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gold-400 font-medium">
                          <DollarSign size={11} />{formatCurrency(service.price)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] mt-1 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Barbeiro ── */}
      {step === "barber" && (
        <div className="animate-slide-up">
          <button onClick={() => setStep("service")} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors mb-4">
            <ChevronLeft size={16} /> Voltar
          </button>
          <div className="card p-3 flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gold-600/10 shrink-0"><Scissors size={16} className="text-gold-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{selectedService?.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{selectedService?.duration}min · {formatCurrency(selectedService?.price ?? 0)}</p>
            </div>
          </div>
          <h2 className="text-base font-medium text-white mb-4">Escolha o barbeiro</h2>
          {loadingBarbers ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : barbers.length === 0 ? (
            <EmptyState icon={<User size={24} />} title="Nenhum barbeiro disponível" />
          ) : (
            <div className="space-y-3">
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => handleSelectBarber(barber)}
                  className="w-full text-left p-4 rounded-xl border bg-dark-300 border-dark-50 hover:border-gold-600/30 hover:bg-dark-200 transition-all duration-200 flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-full bg-gold-600/15 border border-gold-600/25 flex items-center justify-center text-gold-500 font-display font-semibold text-base shrink-0">
                    {barber.user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{barber.user.name}</p>
                    <p className="text-xs text-emerald-400 mt-0.5">● Disponível</p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Data / Hora ── */}
      {step === "datetime" && (
        <div className="animate-slide-up">
          <button onClick={() => setStep("barber")} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors mb-4">
            <ChevronLeft size={16} /> Voltar
          </button>
          <h2 className="text-base font-medium text-white mb-4">Escolha data e horário</h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Data</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCalendarOffset(Math.max(0, calendarOffset - 7))}
                  disabled={calendarOffset === 0}
                  className="p-1.5 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
                </button>
                <button
                  onClick={() => setCalendarOffset(Math.min(7, calendarOffset + 7))}
                  disabled={calendarOffset >= 7}
                  className="p-1.5 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all"
                  aria-label="Próxima semana"
                >
                  <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {visibleDates.map((date) => {
                const dateKey    = format(date, "yyyy-MM-dd");
                const isSelected = dateKey === selectedDateStr;
                const isToday    = dateKey === todayStr;
                return (
                  <button
                    key={dateKey}
                    onClick={() => handleSelectDate(date)}
                    className={cn(
                      "flex flex-col items-center py-2 rounded-xl border text-xs transition-all duration-200",
                      isSelected ? "bg-gold-600 border-gold-500 text-white"
                      : isToday  ? "bg-dark-200 border-gold-600/40 text-gold-400"
                      : "bg-dark-300 border-dark-50 text-[var(--text-secondary)] hover:border-gold-600/30"
                    )}
                  >
                    <span className="text-[9px] opacity-70 font-medium">
                      {format(date, "EEE", { locale: ptBR }).slice(0, 3).toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm leading-tight">{format(date, "d")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="section-label mb-3">
              Horários disponíveis — {format(selectedDate, "dd/MM", { locale: ptBR })}
            </p>
            {loadingSlots ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : !availability?.slots?.length ? (
              <div className="card p-6 text-center">
                <Calendar size={20} className="text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-muted)]">Nenhum horário disponível nesta data</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availability.slots.map((slot: string) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      "py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200",
                      selectedTime === slot
                        ? "bg-gold-600 border-gold-500 text-white"
                        : "bg-dark-300 border-dark-50 text-[var(--text-secondary)] hover:border-gold-600/30 hover:text-white"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTime && (
            <Button className="w-full mt-6" size="lg" onClick={() => setStep("confirm")}>
              Continuar
            </Button>
          )}
        </div>
      )}

      {/* ── STEP 4: Confirmar ── */}
      {step === "confirm" && (
        <div className="animate-slide-up">
          <button onClick={() => setStep("datetime")} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors mb-4">
            <ChevronLeft size={16} /> Voltar
          </button>
          <h2 className="text-base font-medium text-white mb-5">Confirmar agendamento</h2>

          <div className="card divide-y divide-dark-50 mb-5">
            <div className="p-4 flex items-center gap-3">
              <Scissors size={16} className="text-gold-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="section-label">Serviço</p>
                <p className="text-sm font-medium text-white truncate">{selectedService?.name}</p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <User size={16} className="text-gold-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="section-label">Barbeiro</p>
                <p className="text-sm font-medium text-white truncate">{selectedBarber?.user.name}</p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <Calendar size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Data e Hora</p>
                <p className="text-sm font-medium text-white">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <DollarSign size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Valor</p>
                <p className="text-sm font-medium text-gold-400">{formatCurrency(selectedService?.price ?? 0)}</p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <Clock size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Duração</p>
                <p className="text-sm font-medium text-white">{selectedService?.duration} minutos</p>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="section-label mb-3">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("CASH")}
                className={cn(
                  "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200",
                  paymentMethod === "CASH"
                    ? "bg-gold-600/15 border-gold-600/50 text-gold-400"
                    : "bg-dark-300 border-dark-50 text-[var(--text-secondary)] hover:border-gold-600/20"
                )}
              >
                <Banknote size={22} />
                <div className="text-center">
                  <p className="text-sm font-semibold">Pagar na Barbearia</p>
                  <p className="text-[10px] opacity-70 mt-0.5">No dia do atendimento</p>
                </div>
                {paymentMethod === "CASH" && (
                  <div className="w-4 h-4 rounded-full bg-gold-600 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>

              <div className="p-4 rounded-xl border flex flex-col items-center gap-2 bg-dark-400 border-dark-50 opacity-50 cursor-not-allowed">
                <QrCode size={22} className="text-[var(--text-muted)]" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text-muted)]">PIX</p>
                  <p className="text-[10px] mt-0.5 text-[var(--text-muted)]">Em breve</p>
                </div>
                <span className="text-[9px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 px-2 py-0.5 rounded-full">
                  Indisponível
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
              Pague diretamente na barbearia no dia do atendimento.
            </p>
          </div>

          <div className="mb-6">
            <label className="section-label block mb-2">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Prefiro franja mais curta..."
              className="input-field resize-none h-20"
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            loading={bookMutation.isPending}
            onClick={() => bookMutation.mutate()}
          >
            <Check size={16} /> Confirmar agendamento
          </Button>
        </div>
      )}
    </div>
  );
}