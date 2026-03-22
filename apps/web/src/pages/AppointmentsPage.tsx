// src/pages/AppointmentsPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, User, XCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { appointmentsApi } from "@/lib/api";
import { Button, EmptyState, Spinner, Modal } from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_CLASSES,
  type Appointment,
  type AppointmentStatus,
} from "@/types";
import toast from "react-hot-toast";

// Removidos CONFIRMED e IN_PROGRESS — esses status não existem mais no fluxo
const STATUS_FILTER: { label: string; value: string }[] = [
  { label: "Todos",     value: ""          },
  { label: "Pendente",  value: "PENDING"   },
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
  const canCancel = (status: AppointmentStatus) => status === "PENDING";

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Meus Horários
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Histórico e agendamentos futuros
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate("/agendar")}>
          Agendar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_FILTER.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
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
            <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate("/agendar")}>
              Fazer agendamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div key={apt.id} className="card-elevated p-4">
              {/* Linha 1: status + cancelar */}
              <div className="flex items-center justify-between mb-2">
                <span className={STATUS_CLASSES[apt.status]}>
                  {STATUS_LABELS[apt.status]}
                </span>
                {canCancel(apt.status) && (
                  <button
                    onClick={() => setCancelId(apt.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </div>

              {/* Serviço */}
              <p className="font-semibold text-white text-sm mb-2">
                {apt.service?.name ?? "—"}
              </p>

              {/* Detalhes */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Calendar size={12} className="shrink-0 text-[var(--text-muted)]" />
                  <span>
                    {format(new Date(apt.scheduledAt), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Clock size={12} className="shrink-0 text-[var(--text-muted)]" />
                  <span>
                    {format(new Date(apt.scheduledAt), "HH:mm")} —{" "}
                    {format(new Date(apt.endsAt), "HH:mm")}
                  </span>
                </div>
                {apt.barberProfile && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <User size={12} className="shrink-0 text-[var(--text-muted)]" />
                    <span>{apt.barberProfile.user.name}</span>
                  </div>
                )}
              </div>

              {/* Valor */}
              {apt.service && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-50/60">
                  <span className="text-xs text-[var(--text-muted)]">Valor</span>
                  <span className="text-sm font-semibold text-gold-400">
                    {formatCurrency(apt.service.price)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal cancelamento */}
      <Modal
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancelar agendamento"
        size="sm"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setCancelId(null)}>
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