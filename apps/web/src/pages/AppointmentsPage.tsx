// src/pages/AppointmentsPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Scissors,
  User,
  XCircle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { appointmentsApi } from "@/lib/api";
import {
  Button,
  EmptyState,
  Spinner,
  Modal,
  Badge,
} from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_CLASSES,
  type Appointment,
  type AppointmentStatus,
} from "@/types";
import toast from "react-hot-toast";

const STATUS_FILTER: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Pendente", value: "PENDING" },
  { label: "Confirmado", value: "CONFIRMED" },
  { label: "Concluído", value: "COMPLETED" },
  { label: "Cancelado", value: "CANCELLED" },
];

export function AppointmentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", statusFilter],
    queryFn: () =>
      appointmentsApi
        .list({ status: statusFilter || undefined, limit: 50 })
        .then((r) => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.cancel(id),
    onSuccess: () => {
      toast.success("Agendamento cancelado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setCancelId(null);
    },
    onError: () => toast.error("Erro ao cancelar"),
  });

  const appointments: Appointment[] = data?.data ?? [];

  const canCancel = (status: AppointmentStatus) =>
    status === "PENDING" || status === "CONFIRMED";

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Meus Horários
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Histórico e agendamentos futuros
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => navigate("/agendar")}
        >
          Agendar
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {STATUS_FILTER.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              statusFilter === f.value
                ? "bg-gold-600/20 text-gold-400 border border-gold-600/30"
                : "bg-dark-300 border border-dark-50 text-[var(--text-muted)] hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Calendar size={24} />}
          title="Nenhum agendamento"
          description="Você ainda não tem agendamentos. Que tal marcar um horário?"
          action={
            <Button
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => navigate("/agendar")}
            >
              Fazer agendamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="card-elevated p-4 hover:border-dark-50/60 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={STATUS_CLASSES[apt.status]}>
                      {STATUS_LABELS[apt.status]}
                    </span>
                  </div>

                  <h3 className="font-medium text-white text-sm">
                    {apt.service?.name}
                  </h3>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Calendar size={12} className="text-[var(--text-muted)]" />
                      {format(
                        new Date(apt.scheduledAt),
                        "EEEE, dd 'de' MMMM",
                        { locale: ptBR }
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Clock size={12} className="text-[var(--text-muted)]" />
                      {format(new Date(apt.scheduledAt), "HH:mm")} —{" "}
                      {format(new Date(apt.endsAt), "HH:mm")}
                    </div>
                    {apt.barberProfile && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <User size={12} className="text-[var(--text-muted)]" />
                        {apt.barberProfile.user.name}
                      </div>
                    )}
                    {apt.service && (
                      <div className="flex items-center gap-2 text-xs text-gold-400">
                        <Scissors
                          size={12}
                          className="text-[var(--text-muted)]"
                        />
                        {formatCurrency(apt.service.price)}
                      </div>
                    )}
                  </div>
                </div>

                {canCancel(apt.status) && (
                  <button
                    onClick={() => setCancelId(apt.id)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <XCircle size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancelar agendamento"
        size="sm"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          Tem certeza que deseja cancelar este agendamento? Esta ação não pode
          ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setCancelId(null)}
          >
            Voltar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={cancelMutation.isPending}
            onClick={() => cancelId && cancelMutation.mutate(cancelId)}
          >
            Cancelar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
