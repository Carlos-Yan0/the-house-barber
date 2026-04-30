// src/pages/barber/BarberSchedulePage.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Save, Plus, X, CalendarOff, AlertCircle } from "lucide-react";
import { barbersApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuthStore } from "@/store/authStore";
import { Button, Spinner, Modal, Input } from "@/components/ui";
import { DAY_LABELS, type DayOfWeek } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const DAYS: DayOfWeek[] = [
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY",
];

const DEFAULT_SCHEDULE = DAYS.map((day) => ({
  dayOfWeek: day,
  startTime: "09:00",
  endTime: "18:00",
  hasLunchBreak: false,
  lunchStartTime: "",
  lunchEndTime: "",
  slotDuration: 30,
  isActive: false,
}));

interface ScheduleForm {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  hasLunchBreak: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
  slotDuration: number;
  isActive: boolean;
}

export function BarberSchedulePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const barberId = user?.barberProfile?.id;

  const [schedules, setSchedules] = useState<ScheduleForm[]>(DEFAULT_SCHEDULE);
  const [hydrated, setHydrated] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const { data: barberData, isLoading, isError } = useQuery({
    queryKey: ["barber-schedule", barberId],
    queryFn: () => barbersApi.getSchedule(barberId!).then((r) => r.data),
    enabled: !!barberId,
  });

  useEffect(() => {
    if (!barberData || hydrated) return;
    const filled = DAYS.map((day) => {
      const existing = (barberData as any).schedules?.find((s: any) => s.dayOfWeek === day);
      const lunchStart = existing?.lunchStartTime ?? null;
      const lunchEnd = existing?.lunchEndTime ?? null;
      const hasLunchBreak = !!(lunchStart && lunchEnd);
      return {
        dayOfWeek: day,
        startTime:    existing?.startTime    ?? "09:00",
        endTime:      existing?.endTime      ?? "18:00",
        hasLunchBreak,
        lunchStartTime: hasLunchBreak ? lunchStart : "",
        lunchEndTime:   hasLunchBreak ? lunchEnd   : "",
        slotDuration: existing?.slotDuration ?? 30,
        isActive:     existing?.isActive     ?? false,
      };
    });
    setSchedules(filled);
    setHydrated(true);
  }, [barberData, hydrated]);

  const validateSchedules = (): boolean => {
    for (const s of schedules) {
      if (!s.isActive) continue;

      if (!s.hasLunchBreak) continue;

      const ls = s.lunchStartTime.trim();
      const le = s.lunchEndTime.trim();
      if (!ls || !le) continue; // parcial será ignorado (enviado como null)

      if (!(s.startTime < ls && ls < le && le < s.endTime)) {
        toast.error(
          `Em ${DAY_LABELS[s.dayOfWeek]}, o almoço precisa ficar entre o horário de abertura e o de fechamento do dia. Ajuste e salve de novo.`
        );
        return false;
      }
    }
    return true;
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!validateSchedules()) return Promise.reject(new Error("__INVALID_LUNCH_WITHIN_WORKING_HOURS__"));

      const payload = schedules.map((s) => {
        const ls = s.lunchStartTime.trim();
        const le = s.lunchEndTime.trim();
        const normalizedLunch =
          s.isActive && s.hasLunchBreak && ls && le
            ? { lunchStartTime: ls, lunchEndTime: le }
            : { lunchStartTime: null, lunchEndTime: null };

        return {
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: s.slotDuration,
          isActive: s.isActive,
          ...normalizedLunch,
        };
      });

      return barbersApi.updateSchedule(barberId!, payload);
    },
    onSuccess: () => {
      toast.success("Agenda atualizada!");
      qc.invalidateQueries({ queryKey: ["barber-schedule"] });
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === "__INVALID_LUNCH_WITHIN_WORKING_HOURS__") return;
      toast.error(getApiErrorMessage(err, "Erro ao salvar a agenda"));
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => barbersApi.blockDate(barberId!, blockDate, blockReason || undefined),
    onSuccess: () => {
      toast.success("Data bloqueada com sucesso");
      qc.invalidateQueries({ queryKey: ["barber-schedule"] });
      setBlockModal(false);
      setBlockDate("");
      setBlockReason("");
    },
    onError: (err: unknown) =>
      toast.error(getApiErrorMessage(err, "Erro ao bloquear a data")),
  });

  const unblockMutation = useMutation({
    mutationFn: (dateId: string) => barbersApi.unblockDate(barberId!, dateId),
    onSuccess: () => {
      toast.success("Data desbloqueada");
      qc.invalidateQueries({ queryKey: ["barber-schedule"] });
    },
    onError: (err: unknown) =>
      toast.error(getApiErrorMessage(err, "Erro ao desbloquear a data")),
  });

  const updateSchedule = (day: DayOfWeek, field: keyof ScheduleForm, value: any) => {
    setSchedules((prev) => prev.map((s) => (s.dayOfWeek === day ? { ...s, [field]: value } : s)));
  };

  if (!barberId) {
    return (
      <div className="page-container flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle size={28} className="text-yellow-400" />
        <p className="text-sm text-[var(--text-secondary)] text-center max-w-xs">
          Perfil de barbeiro não encontrado. Tente sair e entrar novamente.
        </p>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;

  if (isError) {
    return (
      <div className="page-container flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-[var(--text-secondary)] text-center">
          Não foi possível carregar a agenda. Tente novamente.
        </p>
      </div>
    );
  }

  const blockedDates: any[] = (barberData as any)?.blockedDates ?? [];

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Minha Agenda</h1>
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

      {/* ── Horários de trabalho ── */}
      <div className="card mb-6">
        <div className="px-4 py-3 border-b border-dark-50">
          <h2 className="font-medium text-white text-sm">Horários de trabalho</h2>
        </div>

        <div className="divide-y divide-dark-50">
          {schedules.map((s) => (
            <div key={s.dayOfWeek} className="px-4 py-4">
              {/* Dia + toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-sm font-semibold", s.isActive ? "text-white" : "text-[var(--text-muted)]")}>
                  {DAY_LABELS[s.dayOfWeek]}
                </span>
                <button
                  onClick={() => updateSchedule(s.dayOfWeek, "isActive", !s.isActive)}
                  aria-label={s.isActive ? `Desativar ${DAY_LABELS[s.dayOfWeek]}` : `Ativar ${DAY_LABELS[s.dayOfWeek]}`}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all duration-200 relative shrink-0",
                    s.isActive ? "bg-gold-600" : "bg-dark-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200",
                    s.isActive ? "left-5" : "left-0.5"
                  )} />
                </button>
              </div>

              {/* Campos de horário — layout em linha com labels acima */}
              {s.isActive && (
                <div className="grid grid-cols-3 gap-3">
                  {/* Início */}
                  <div className="flex flex-col gap-1">
                    <span className="section-label">Início</span>
                    <input
                      type="time"
                      value={s.startTime}
                      onChange={(e) => updateSchedule(s.dayOfWeek, "startTime", e.target.value)}
                      className="w-full bg-dark-400 border border-dark-50 rounded-lg px-2 py-2 text-white text-sm
                                 focus:outline-none focus:border-gold-600 transition-all
                                 [color-scheme:dark]"
                    />
                  </div>

                  {/* Fim */}
                  <div className="flex flex-col gap-1">
                    <span className="section-label">Fim</span>
                    <input
                      type="time"
                      value={s.endTime}
                      onChange={(e) => updateSchedule(s.dayOfWeek, "endTime", e.target.value)}
                      className="w-full bg-dark-400 border border-dark-50 rounded-lg px-2 py-2 text-white text-sm
                                 focus:outline-none focus:border-gold-600 transition-all
                                 [color-scheme:dark]"
                    />
                  </div>

                </div>
              )}

              {/* Almoço (somente se o dia estiver ativo) */}
              {s.isActive && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Almoço</span>
                    <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.hasLunchBreak}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateSchedule(s.dayOfWeek, "hasLunchBreak", checked);
                          if (!checked) {
                            updateSchedule(s.dayOfWeek, "lunchStartTime", "");
                            updateSchedule(s.dayOfWeek, "lunchEndTime", "");
                          }
                        }}
                        className="accent-gold-600"
                      />
                      Habilitar
                    </label>
                  </div>

                  {s.hasLunchBreak && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="section-label">Início</span>
                        <input
                          type="time"
                          value={s.lunchStartTime}
                          onChange={(e) => updateSchedule(s.dayOfWeek, "lunchStartTime", e.target.value)}
                          className="w-full bg-dark-400 border border-dark-50 rounded-lg px-2 py-2 text-white text-sm
                                     focus:outline-none focus:border-gold-600 transition-all
                                     [color-scheme:dark]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="section-label">Fim</span>
                        <input
                          type="time"
                          value={s.lunchEndTime}
                          onChange={(e) => updateSchedule(s.dayOfWeek, "lunchEndTime", e.target.value)}
                          className="w-full bg-dark-400 border border-dark-50 rounded-lg px-2 py-2 text-white text-sm
                                     focus:outline-none focus:border-gold-600 transition-all
                                     [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slot (após almoço) */}
              {s.isActive && (
                <div className="mt-3 grid grid-cols-1 gap-3 max-w-[220px]">
                  <div className="flex flex-col gap-1">
                    <span className="section-label">Slot</span>
                    <select
                      value={s.slotDuration}
                      onChange={(e) => updateSchedule(s.dayOfWeek, "slotDuration", Number(e.target.value))}
                      className="w-full bg-dark-400 border border-dark-50 rounded-lg px-2 py-2 text-white text-sm
                                 appearance-none focus:outline-none focus:border-gold-600 transition-all"
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

      {/* ── Datas bloqueadas ── */}
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
                  {bd.reason && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{bd.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => unblockMutation.mutate(bd.id)}
                  disabled={unblockMutation.isPending}
                  aria-label="Desbloquear data"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal bloquear data */}
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
