// src/pages/barber/BarberSchedulePage.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Save, Plus, X, CalendarOff } from "lucide-react";
import { barbersApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button, Spinner, Modal, Input } from "@/components/ui";
import { DAY_LABELS, type DayOfWeek } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const DAYS: DayOfWeek[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
];

const DEFAULT_SCHEDULE = DAYS.map((day) => ({
  dayOfWeek: day,
  startTime: "09:00",
  endTime: "18:00",
  slotDuration: 30,
  isActive: false,
}));

interface ScheduleForm {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
}

export function BarberSchedulePage() {
  const { user } = useAuthStore();
  const barberId = user?.barberProfile?.id;
  const qc = useQueryClient();

  const [schedules, setSchedules] = useState<ScheduleForm[]>(DEFAULT_SCHEDULE);
  const [hydrated, setHydrated] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Fallback: if barberProfile not in store, fetch from API
  const { data: barbersList } = useQuery({
    queryKey: ["barbers-list-for-self"],
    queryFn: () => barbersApi.list().then((r) => r.data as any[]),
    enabled: !barberId,
  });

  // Try to find own barber profile from list if not in store
  const resolvedBarberId = barberId ?? 
    barbersList?.find((b: any) => b.userId === user?.id)?.id ??
    barbersList?.[0]?.id; // last resort

  const { data: barberData, isLoading } = useQuery({
    queryKey: ["barber-schedule", resolvedBarberId],
    queryFn: () => barbersApi.getSchedule(resolvedBarberId!).then((r) => r.data),
    enabled: !!resolvedBarberId,
  });

  // TanStack Query v5 removed onSuccess — use useEffect instead
  useEffect(() => {
    if (!barberData || hydrated) return;
    const filled = DAYS.map((day) => {
      const existing = (barberData as any).schedules?.find(
        (s: any) => s.dayOfWeek === day
      );
      return {
        dayOfWeek: day,
        startTime: existing?.startTime ?? "09:00",
        endTime: existing?.endTime ?? "18:00",
        slotDuration: existing?.slotDuration ?? 30,
        isActive: existing?.isActive ?? false,
      };
    });
    setSchedules(filled);
    setHydrated(true);
  }, [barberData, hydrated]);

  const saveMutation = useMutation({
    mutationFn: () => barbersApi.updateSchedule(resolvedBarberId!, schedules),
    onSuccess: () => {
      toast.success("Agenda atualizada!");
      qc.invalidateQueries({ queryKey: ["barber-schedule"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const blockMutation = useMutation({
    mutationFn: () =>
      barbersApi.blockDate(resolvedBarberId!, blockDate, blockReason || undefined),
    onSuccess: () => {
      toast.success("Data bloqueada");
      qc.invalidateQueries({ queryKey: ["barber-schedule"] });
      setBlockModal(false);
      setBlockDate("");
      setBlockReason("");
    },
    onError: () => toast.error("Erro ao bloquear data"),
  });

  const unblockMutation = useMutation({
    mutationFn: (dateId: string) => barbersApi.unblockDate(resolvedBarberId!, dateId),
    onSuccess: () => {
      toast.success("Data desbloqueada");
      qc.invalidateQueries({ queryKey: ["barber-schedule"] });
    },
  });

  const updateSchedule = (day: DayOfWeek, field: keyof ScheduleForm, value: any) => {
    setSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === day ? { ...s, [field]: value } : s))
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={28} />
      </div>
    );
  }

  const blockedDates: any[] = (barberData as any)?.blockedDates ?? [];

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Minha Agenda
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Configure seus dias e horários de atendimento
          </p>
        </div>
        <Button
          size="sm"
          icon={<Save size={14} />}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Salvar
        </Button>
      </div>

      {/* Working hours */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-dark-50">
          <h2 className="font-medium text-white text-sm">Horários de trabalho</h2>
        </div>
        <div className="divide-y divide-dark-50">
          {schedules.map((s) => (
            <div key={s.dayOfWeek} className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-sm font-medium", s.isActive ? "text-white" : "text-[var(--text-muted)]")}>
                  {DAY_LABELS[s.dayOfWeek]}
                </span>
                {/* Toggle */}
                <button
                  onClick={() => updateSchedule(s.dayOfWeek, "isActive", !s.isActive)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all duration-200 relative",
                    s.isActive ? "bg-gold-600" : "bg-dark-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200",
                    s.isActive ? "left-5" : "left-0.5"
                  )} />
                </button>
              </div>

              {s.isActive && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="section-label mb-1">Início</p>
                    <input
                      type="time"
                      value={s.startTime}
                      onChange={(e) => updateSchedule(s.dayOfWeek, "startTime", e.target.value)}
                      className="input-field text-xs py-2"
                    />
                  </div>
                  <div>
                    <p className="section-label mb-1">Fim</p>
                    <input
                      type="time"
                      value={s.endTime}
                      onChange={(e) => updateSchedule(s.dayOfWeek, "endTime", e.target.value)}
                      className="input-field text-xs py-2"
                    />
                  </div>
                  <div>
                    <p className="section-label mb-1">Slot (min)</p>
                    <select
                      value={s.slotDuration}
                      onChange={(e) => updateSchedule(s.dayOfWeek, "slotDuration", Number(e.target.value))}
                      className="input-field text-xs py-2 appearance-none"
                    >
                      <option value={15}>15min</option>
                      <option value={30}>30min</option>
                      <option value={45}>45min</option>
                      <option value={60}>60min</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Blocked dates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white">Datas bloqueadas</h2>
          <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setBlockModal(true)}>
            Bloquear data
          </Button>
        </div>

        {blockedDates.length === 0 ? (
          <div className="card p-6 text-center">
            <CalendarOff size={20} className="text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Nenhuma data bloqueada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blockedDates.map((bd: any) => (
              <div key={bd.id} className="card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">
                    {format(new Date(bd.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </p>
                  {bd.reason && <p className="text-xs text-[var(--text-muted)] mt-0.5">{bd.reason}</p>}
                </div>
                <button
                  onClick={() => unblockMutation.mutate(bd.id)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block Date Modal */}
      <Modal isOpen={blockModal} onClose={() => setBlockModal(false)} title="Bloquear data" size="sm">
        <div className="space-y-4">
          <Input
            label="Data"
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            min={format(new Date(), "yyyy-MM-dd")}
          />
          <Input
            label="Motivo (opcional)"
            placeholder="Ex: Férias, compromisso..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <Button
            className="w-full"
            loading={blockMutation.isPending}
            onClick={() => blockMutation.mutate()}
            disabled={!blockDate}
          >
            Bloquear data
          </Button>
        </div>
      </Modal>
    </div>
  );
}