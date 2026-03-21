// src/pages/BookingPage.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Clock, DollarSign,
  User, Calendar, Check, Scissors, Banknote, QrCode, Copy, CheckCheck,
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

// ── PIX Modal ───────────────────────────────────────────────────────────────
interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  pixCopiaECola: string;
  ticketUrl: string;
  expiresAt: string;
  mpPaymentId: number;
}

interface PixModalProps {
  pix: PixData;
  appointmentId: string;
  onDone: () => void;
}

function PixModal({ pix, appointmentId, onDone }: PixModalProps) {
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const queryClient = useQueryClient();

  // Polling a cada 5s para verificar se o pagamento foi confirmado
  useEffect(() => {
    if (paid) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? "http://localhost:3333"}/payments/pix/status/${appointmentId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("thb-auth") 
                ? JSON.parse(localStorage.getItem("thb-auth")!).state?.token 
                : ""}`,
            },
          }
        );
        const data = await res.json();
        if (data.paid) {
          setPaid(true);
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          toast.success("Pagamento confirmado!");
        }
      } catch {
        // Silenciar erros de polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paid, appointmentId, queryClient]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pix.pixCopiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    toast.success("Código PIX copiado!");
  };

  const expiresDate = new Date(pix.expiresAt);
  const expiresStr  = format(expiresDate, "HH:mm", { locale: ptBR });

  return (
    <div className="fixed inset-0 z-50 bg-dark-500/95 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto py-8 px-4">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gold-600/15 border border-gold-600/25 flex items-center justify-center mx-auto mb-3">
            <QrCode size={24} className="text-gold-500" />
          </div>
          {paid ? (
            <>
              <h2 className="font-display text-xl font-semibold text-white">Pago!</h2>
              <p className="text-sm text-emerald-400 mt-1">Pagamento confirmado com sucesso</p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-white">Pague com PIX</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Expira às {expiresStr}</p>
            </>
          )}
        </div>

        {paid ? (
          <div className="card p-6 text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-emerald-400" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Seu agendamento está confirmado. Até logo!
            </p>
          </div>
        ) : (
          <>
            {/* QR Code */}
            {pix.qrCodeBase64 ? (
              <div className="card p-4 flex items-center justify-center mb-4">
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-xl"
                />
              </div>
            ) : (
              <div className="card p-4 mb-4">
                <p className="text-xs text-[var(--text-muted)] text-center">QR Code indisponível</p>
              </div>
            )}

            {/* Copia e Cola */}
            <div className="card p-4 mb-4">
              <p className="section-label mb-2">Pix Copia e Cola</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-[var(--text-secondary)] flex-1 truncate font-mono bg-dark-400 rounded-lg px-3 py-2">
                  {pix.pixCopiaECola.slice(0, 40)}...
                </p>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-gold-600/15 border border-gold-600/25 text-gold-400 hover:bg-gold-600/25 transition-all shrink-0"
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Instruções */}
            <div className="card p-4 mb-6">
              <p className="section-label mb-2">Como pagar</p>
              <ol className="space-y-1.5">
                {[
                  "Abra o app do seu banco",
                  "Escolha pagar com PIX",
                  "Escaneie o QR Code ou cole o código",
                  "Confirme o pagamento",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="w-4 h-4 rounded-full bg-gold-600/20 text-gold-400 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <Button
          className="w-full"
          size="lg"
          variant={paid ? "gold" : "outline"}
          onClick={onDone}
        >
          {paid ? "Ver meus agendamentos" : "Já paguei / ver agendamentos"}
        </Button>

        {!paid && (
          <p className="text-xs text-[var(--text-muted)] text-center mt-3">
            O agendamento já está reservado. Pague antes de {expiresStr}.
          </p>
        )}
      </div>
    </div>
  );
}

// ── BookingPage ─────────────────────────────────────────────────────────────
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
  const [pixData,          setPixData]          = useState<PixData | null>(null);
  const [pixAppointmentId, setPixAppointmentId] = useState<string>("");

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
      const dateStr   = format(selectedDate, "yyyy-MM-dd");
      const scheduledAt = new Date(`${dateStr}T${selectedTime!}:00${BRT_OFFSET}`).toISOString();

      return appointmentsApi.create({
        barberProfileId: selectedBarber!.id,
        serviceId:       selectedService!.id,
        scheduledAt,
        paymentMethod,
        notes: notes || undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const data = res.data;

      if (data.paymentMethod === "PIX" && data.pix) {
        setPixData(data.pix);
        setPixAppointmentId(data.appointment.id);
      } else {
        toast.success("Agendamento realizado! Pague na barbearia.");
        navigate("/agendamentos");
      }
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

  useEffect(() => {
    const serviceId = searchParams.get("service");
    if (serviceId && services.length > 0) {
      const found = services.find((s) => s.id === serviceId);
      if (found) { setSelectedService(found); setStep("barber"); }
    }
  }, [searchParams, services]);

  if (pixData) {
    return (
      <PixModal
        pix={pixData}
        appointmentId={pixAppointmentId}
        onDone={() => navigate("/agendamentos")}
      />
    );
  }

  const stepIndex   = STEPS.findIndex((s) => s.key === step);
  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));
  const visibleDates = dateOptions.slice(calendarOffset, calendarOffset + 7);

  const StepIndicator = () => (
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

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Novo Agendamento</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Escolha um serviço e horário disponível</p>
      </div>

      <StepIndicator />

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
                  onClick={() => { setSelectedService(service); setStep("barber"); }}
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
                  onClick={() => { setSelectedBarber(barber); setStep("datetime"); }}
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
                <button onClick={() => setCalendarOffset(Math.max(0, calendarOffset - 7))} disabled={calendarOffset === 0} className="p-1.5 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all" aria-label="Semana anterior">
                  <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
                </button>
                <button onClick={() => setCalendarOffset(Math.min(7, calendarOffset + 7))} disabled={calendarOffset >= 7} className="p-1.5 rounded-lg hover:bg-dark-200 disabled:opacity-30 transition-all" aria-label="Próxima semana">
                  <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {visibleDates.map((date) => {
                const dateKey   = format(date, "yyyy-MM-dd");
                const isSelected = dateKey === format(selectedDate, "yyyy-MM-dd");
                const isToday    = dateKey === format(new Date(), "yyyy-MM-dd");
                return (
                  <button
                    key={dateKey}
                    onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
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
            <p className="section-label mb-3">Horários disponíveis — {format(selectedDate, "dd/MM", { locale: ptBR })}</p>
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

          {/* Resumo */}
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

          {/* Forma de pagamento */}
          <div className="mb-5">
            <p className="section-label mb-3">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Dinheiro */}
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
                  <p className="text-sm font-semibold">Dinheiro</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Paga na barbearia</p>
                </div>
                {paymentMethod === "CASH" && (
                  <div className="w-4 h-4 rounded-full bg-gold-600 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>

              {/* PIX */}
              <button
                onClick={() => setPaymentMethod("PIX")}
                className={cn(
                  "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200",
                  paymentMethod === "PIX"
                    ? "bg-gold-600/15 border-gold-600/50 text-gold-400"
                    : "bg-dark-300 border-dark-50 text-[var(--text-secondary)] hover:border-gold-600/20"
                )}
              >
                <QrCode size={22} />
                <div className="text-center">
                  <p className="text-sm font-semibold">PIX</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Paga agora</p>
                </div>
                {paymentMethod === "PIX" && (
                  <div className="w-4 h-4 rounded-full bg-gold-600 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>
            </div>

            {paymentMethod === "PIX" && (
              <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                Um QR Code será gerado. Você terá 30 minutos para pagar.
              </p>
            )}
            {paymentMethod === "CASH" && (
              <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                Pague diretamente na barbearia no dia do atendimento.
              </p>
            )}
          </div>

          {/* Observações */}
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
            {paymentMethod === "PIX" ? (
              <><QrCode size={16} /> Confirmar e pagar com PIX</>
            ) : (
              <><Check size={16} /> Confirmar agendamento</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}