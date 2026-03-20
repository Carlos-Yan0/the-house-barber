// src/pages/BookingPage.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  User,
  Calendar,
  Check,
  Scissors,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { servicesApi, barbersApi, appointmentsApi } from "@/lib/api";
import { Button, Spinner, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Service, BarberProfile } from "@/types";
import toast from "react-hot-toast";

type Step = "service" | "barber" | "datetime" | "confirm";

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<BarberProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [calendarOffset, setCalendarOffset] = useState(0);

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
    queryKey: [
      "availability",
      selectedBarber?.id,
      format(selectedDate, "yyyy-MM-dd"),
      selectedService?.id,
    ],
    queryFn: () =>
      appointmentsApi
        .getAvailability(
          selectedBarber!.id,
          format(selectedDate, "yyyy-MM-dd"),
          selectedService!.id
        )
        .then((r) => r.data),
    enabled: step === "datetime" && !!selectedBarber && !!selectedService,
  });

  const bookMutation = useMutation({
    mutationFn: () => {
      const [h, m] = selectedTime!.split(":");
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(Number(h), Number(m), 0, 0);

      return appointmentsApi.create({
        barberProfileId: selectedBarber!.id,
        serviceId: selectedService!.id,
        scheduledAt: scheduledAt.toISOString(),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Agendamento realizado com sucesso!");
      navigate("/agendamentos");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? "Erro ao agendar");
    },
  });

  // Pre-select service from URL param
  useEffect(() => {
    const serviceId = searchParams.get("service");
    if (serviceId && services.length > 0) {
      const s = services.find((sv) => sv.id === serviceId);
      if (s) {
        setSelectedService(s);
        setStep("barber");
      }
    }
  }, [searchParams, services]);

  const STEPS: { key: Step; label: string }[] = [
    { key: "service", label: "Serviço" },
    { key: "barber", label: "Barbeiro" },
    { key: "datetime", label: "Data/Hora" },
    { key: "confirm", label: "Confirmar" },
  ];

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // Generate date options (next 14 days)
  const dateOptions = Array.from({ length: 14 }, (_, i) =>
    addDays(startOfDay(new Date()), i)
  );

  const visibleDates = dateOptions.slice(
    calendarOffset,
    calendarOffset + 7
  );

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">
          Novo Agendamento
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Escolha um serviço e horário disponível
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                i < stepIndex
                  ? "bg-gold-600 text-white"
                  : i === stepIndex
                  ? "bg-gold-600/20 border border-gold-600 text-gold-400"
                  : "bg-dark-200 border border-dark-50 text-[var(--text-muted)]"
              )}
            >
              {i < stepIndex ? <Check size={12} /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                i === stepIndex
                  ? "text-white"
                  : "text-[var(--text-muted)]"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="text-dark-50" />
            )}
          </div>
        ))}
      </div>

      {/* STEP 1: Service */}
      {step === "service" && (
        <div className="animate-slide-up">
          <h2 className="text-base font-medium text-white mb-4">
            Qual serviço você deseja?
          </h2>
          {loadingServices ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setSelectedService(service);
                    setStep("barber");
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all duration-200",
                    selectedService?.id === service.id
                      ? "bg-gold-600/10 border-gold-600/40 text-gold-400"
                      : "bg-dark-300 border-dark-50 hover:border-gold-600/30 hover:bg-dark-200"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white text-sm">
                        {service.name}
                      </p>
                      {service.description && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {service.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Clock size={11} /> {service.duration}min
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gold-400 font-medium">
                          <DollarSign size={11} />
                          {formatCurrency(service.price)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-[var(--text-muted)] mt-1"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Barber */}
      {step === "barber" && (
        <div className="animate-slide-up">
          <button
            onClick={() => setStep("service")}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors mb-4"
          >
            <ChevronLeft size={16} /> Voltar
          </button>

          {/* Selected service summary */}
          <div className="card p-3 flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gold-600/10">
              <Scissors size={16} className="text-gold-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {selectedService?.name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedService?.duration}min ·{" "}
                {formatCurrency(selectedService?.price ?? 0)}
              </p>
            </div>
          </div>

          <h2 className="text-base font-medium text-white mb-4">
            Escolha o barbeiro
          </h2>

          {loadingBarbers ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : barbers.length === 0 ? (
            <EmptyState
              icon={<User size={24} />}
              title="Nenhum barbeiro disponível"
              description="Não há barbeiros disponíveis no momento."
            />
          ) : (
            <div className="space-y-3">
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => {
                    setSelectedBarber(barber);
                    setStep("datetime");
                  }}
                  className="w-full text-left p-4 rounded-xl border bg-dark-300 border-dark-50 hover:border-gold-600/30 hover:bg-dark-200 transition-all duration-200 flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-full bg-gold-600/15 border border-gold-600/25 flex items-center justify-center text-gold-500 font-display font-semibold text-base shrink-0">
                    {barber.user.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">
                      {barber.user.name}
                    </p>
                    <p className="text-xs text-emerald-400 mt-0.5">
                      ● Disponível
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Date & Time */}
      {step === "datetime" && (
        <div className="animate-slide-up">
          <button
            onClick={() => setStep("barber")}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors mb-4"
          >
            <ChevronLeft size={16} /> Voltar
          </button>

          <h2 className="text-base font-medium text-white mb-4">
            Escolha data e horário
          </h2>

          {/* Date picker strip */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Data</p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCalendarOffset(Math.max(0, calendarOffset - 7))
                  }
                  disabled={calendarOffset === 0}
                  className="p-1 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
                </button>
                <button
                  onClick={() =>
                    setCalendarOffset(Math.min(7, calendarOffset + 7))
                  }
                  disabled={calendarOffset >= 7}
                  className="p-1 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all"
                >
                  <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {visibleDates.map((date) => {
                const isSelected =
                  format(date, "yyyy-MM-dd") ===
                  format(selectedDate, "yyyy-MM-dd");
                const isToday =
                  format(date, "yyyy-MM-dd") ===
                  format(new Date(), "yyyy-MM-dd");

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime(null);
                    }}
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
                      {format(date, "EEE", { locale: ptBR })
                        .slice(0, 3)
                        .toUpperCase()}
                    </span>
                    <span className="font-semibold">{format(date, "d")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div>
            <p className="section-label mb-3">
              Horários disponíveis —{" "}
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </p>

            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : availability?.slots.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                Nenhum horário disponível nesta data
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {availability?.slots.map((slot: string) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      "py-2 rounded-xl border text-xs font-medium transition-all duration-200",
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
            <Button
              className="w-full mt-6"
              size="lg"
              onClick={() => setStep("confirm")}
            >
              Continuar
            </Button>
          )}
        </div>
      )}

      {/* STEP 4: Confirm */}
      {step === "confirm" && (
        <div className="animate-slide-up">
          <button
            onClick={() => setStep("datetime")}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors mb-4"
          >
            <ChevronLeft size={16} /> Voltar
          </button>

          <h2 className="text-base font-medium text-white mb-5">
            Confirmar agendamento
          </h2>

          <div className="card divide-y divide-dark-50 mb-5">
            <div className="p-4 flex items-center gap-3">
              <Scissors size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Serviço</p>
                <p className="text-sm font-medium text-white">
                  {selectedService?.name}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <User size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Barbeiro</p>
                <p className="text-sm font-medium text-white">
                  {selectedBarber?.user.name}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <Calendar size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Data e Hora</p>
                <p className="text-sm font-medium text-white">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", {
                    locale: ptBR,
                  })}{" "}
                  às {selectedTime}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <DollarSign size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Valor</p>
                <p className="text-sm font-medium text-gold-400">
                  {formatCurrency(selectedService?.price ?? 0)}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <Clock size={16} className="text-gold-500 shrink-0" />
              <div>
                <p className="section-label">Duração</p>
                <p className="text-sm font-medium text-white">
                  {selectedService?.duration} minutos
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="section-label block mb-2">
              Observações (opcional)
            </label>
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
            <Check size={16} />
            Confirmar agendamento
          </Button>
        </div>
      )}
    </div>
  );
}
