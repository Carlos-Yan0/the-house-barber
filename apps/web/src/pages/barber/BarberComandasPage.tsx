// src/pages/barber/BarberComandasPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, CheckCircle, Clock, DollarSign } from "lucide-react";
import { comandasApi, appointmentsApi } from "@/lib/api";
import { Button, EmptyState, Spinner, Modal, Badge } from "@/components/ui";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_CLASSES,
  PAYMENT_LABELS,
  type Comanda,
  type PaymentMethod,
  type Appointment,
  type AppointmentStatus,
} from "@/types";
import toast from "react-hot-toast";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] =
  [
    { value: "PIX", label: "PIX", icon: "◈" },
    { value: "CASH", label: "Dinheiro", icon: "💵" },
    { value: "CREDIT_CARD", label: "Crédito", icon: "💳" },
    { value: "DEBIT_CARD", label: "Débito", icon: "💳" },
  ];

export function BarberComandasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"appointments" | "comandas">("appointments");
  const [closeModal, setCloseModal] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("PIX");
  const [statusModal, setStatusModal] = useState<Appointment | null>(null);

  // Today's confirmed appointments
  const { data: aptData, isLoading: loadingApts } = useQuery({
    queryKey: ["barber-appointments-today"],
    queryFn: () =>
      appointmentsApi
        .list({ date: format(new Date(), "yyyy-MM-dd"), limit: 50 })
        .then((r) => r.data),
  });

  // Open comandas
  const { data: openComandas = [], isLoading: loadingComandas } = useQuery({
    queryKey: ["barber-comandas-open"],
    queryFn: () =>
      comandasApi.list("OPEN").then((r) => r.data as Comanda[]),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success("Status atualizado!");
      qc.invalidateQueries({ queryKey: ["barber-appointments-today"] });
      qc.invalidateQueries({ queryKey: ["barber-comandas-open"] });
      setStatusModal(null);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Erro ao atualizar"),
  });

  const closeMutation = useMutation({
    mutationFn: () => comandasApi.close(closeModal!, selectedPayment),
    onSuccess: () => {
      toast.success("Comanda fechada! Comissão calculada.");
      qc.invalidateQueries({ queryKey: ["barber-comandas-open"] });
      qc.invalidateQueries({ queryKey: ["barber-appointments-today"] });
      setCloseModal(null);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Erro ao fechar comanda"),
  });

  const appointments: Appointment[] = aptData?.data ?? [];

  const NEXT_STATUS: Partial<Record<AppointmentStatus, string>> = {
    PENDING: "CONFIRMED",
    CONFIRMED: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
  };

  const STATUS_ACTION_LABEL: Partial<Record<AppointmentStatus, string>> = {
    PENDING: "Confirmar",
    CONFIRMED: "Iniciar",
    IN_PROGRESS: "Finalizar",
  };

  return (
    <div className="page-container animate-fade-in">
      <h1 className="font-display text-2xl font-semibold text-white mb-6">
        Atendimentos
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-300 rounded-xl p-1 mb-6">
        {[
          { key: "appointments", label: "Agenda Hoje" },
          { key: "comandas", label: `Comandas (${openComandas.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
              tab === t.key
                ? "bg-dark-100 text-white shadow"
                : "text-[var(--text-muted)] hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Appointments Tab */}
      {tab === "appointments" && (
        <>
          {loadingApts ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="Nenhum atendimento hoje"
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={STATUS_CLASSES[apt.status]}>
                            {STATUS_LABELS[apt.status]}
                          </span>
                        </div>
                        <p className="font-medium text-white text-sm">
                          {apt.client?.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {apt.service?.name} ·{" "}
                          {formatCurrency(apt.service?.price ?? 0)}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-1">
                          <Clock size={11} />
                          {formatTime(apt.scheduledAt)} —{" "}
                          {formatTime(apt.endsAt)}
                        </div>
                      </div>

                      {NEXT_STATUS[apt.status] && (
                        <Button
                          size="sm"
                          variant={
                            apt.status === "IN_PROGRESS" ? "outline" : "gold"
                          }
                          onClick={() => setStatusModal(apt)}
                        >
                          {STATUS_ACTION_LABEL[apt.status]}
                        </Button>
                      )}
                    </div>

                    {/* Show "fechar comanda" when IN_PROGRESS has comanda */}
                    {apt.comanda && apt.comanda.status === "OPEN" && (
                      <div className="mt-3 pt-3 border-t border-dark-50">
                        <Button
                          size="sm"
                          className="w-full"
                          icon={<DollarSign size={14} />}
                          onClick={() => setCloseModal(apt.comanda!.id)}
                        >
                          Fechar comanda ·{" "}
                          {formatCurrency(apt.service?.price ?? 0)}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* Comandas Tab */}
      {tab === "comandas" && (
        <>
          {loadingComandas ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : openComandas.length === 0 ? (
            <EmptyState
              icon={<CheckCircle size={22} />}
              title="Nenhuma comanda aberta"
              description="Todas as comandas foram fechadas."
            />
          ) : (
            <div className="space-y-3">
              {openComandas.map((comanda) => (
                <div key={comanda.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white text-sm">
                        {comanda.appointment?.client?.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {comanda.appointment?.service?.name}
                      </p>
                      <p className="text-sm font-semibold text-gold-400 mt-1">
                        {formatCurrency(comanda.totalAmount)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      icon={<DollarSign size={14} />}
                      onClick={() => setCloseModal(comanda.id)}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Status update modal */}
      <Modal
        isOpen={!!statusModal}
        onClose={() => setStatusModal(null)}
        title="Atualizar status"
        size="sm"
      >
        {statusModal && (
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Deseja mudar o status de{" "}
              <strong className="text-white">
                {STATUS_LABELS[statusModal.status]}
              </strong>{" "}
              para{" "}
              <strong className="text-gold-400">
                {STATUS_LABELS[NEXT_STATUS[statusModal.status] as AppointmentStatus]}
              </strong>
              ?
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStatusModal(null)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: statusModal.id,
                    status: NEXT_STATUS[statusModal.status]!,
                  })
                }
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close comanda modal */}
      <Modal
        isOpen={!!closeModal}
        onClose={() => setCloseModal(null)}
        title="Fechar comanda"
        size="sm"
      >
        <div>
          <p className="section-label mb-3">Forma de pagamento</p>
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
            loading={closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            Confirmar pagamento
          </Button>
        </div>
      </Modal>
    </div>
  );
}
