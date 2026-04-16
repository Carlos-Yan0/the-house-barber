// src/pages/barber/BarberEarningsPage.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, endOfMonth } from "date-fns";
import { TrendingUp, DollarSign, CheckCircle, Clock } from "lucide-react";
import { barbersApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatsCard, EmptyState, Spinner } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Commission } from "@/types";

export function BarberEarningsPage() {
  const { user } = useAuthStore();
  const barberId = user?.barberProfile?.id;

  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  // FIX: parse year/month diretamente para evitar bug de fuso horário
  // new Date("2026-03-01") cria UTC midnight → no Brasil (UTC-3) vira 28/02
  const [year, mon] = month.split("-").map(Number);
  const firstDay  = new Date(year, mon - 1, 1);
  const lastDay   = endOfMonth(firstDay);
  const startDate = format(firstDay, "yyyy-MM-dd");
  const endDate   = format(lastDay,  "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["earnings", barberId, month],
    queryFn: () =>
      barbersApi
        .getEarnings(barberId!, { startDate, endDate })
        .then((r) => r.data),
    enabled: !!barberId,
  });

  const commissions: Commission[] = data?.commissions ?? [];
  const paidTotal = commissions
    .filter((c) => c.isPaid)
    .reduce((s, c) => s + Number(c.commissionAmount), 0);
  const pendingTotal = commissions
    .filter((c) => !c.isPaid)
    .reduce((s, c) => s + Number(c.commissionAmount), 0);

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Meus Ganhos
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Comissões por serviços realizados
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input-field text-xs py-2 w-36"
        />
      </div>

      {/* Stats — apenas valores de comissão, sem expor o bruto ao barbeiro */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatsCard
          label="Total do mês"
          value={formatCurrency(data?.totalCommission ?? 0)}
          icon={<TrendingUp size={16} />}
        />
        <StatsCard
          label="Atendimentos"
          value={commissions.length}
          icon={<DollarSign size={16} />}
        />
        <StatsCard
          label="Já recebido"
          value={formatCurrency(paidTotal)}
          icon={<CheckCircle size={16} />}
        />
        <StatsCard
          label="A receber"
          value={formatCurrency(pendingTotal)}
          icon={<Clock size={16} />}
        />
      </div>

      {/* Commissions list */}
      <h2 className="font-display font-semibold text-white mb-4">
        Extrato do mês
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : commissions.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={22} />}
          title="Nenhum ganho neste mês"
          description="Seus ganhos aparecerão aqui após fechar comandas."
        />
      ) : (
        <div className="space-y-2">
          {commissions.map((c) => (
            <div key={c.id} className="card-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white text-sm">
                    {c.comanda?.appointment?.service?.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {c.comanda?.appointment?.client?.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {c.createdAt && formatDate(c.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gold-400">
                    {formatCurrency(c.commissionAmount)}
                  </p>
                  <span
                    className={cn(
                      "text-[10px] font-medium mt-1 inline-block",
                      c.isPaid ? "text-emerald-400" : "text-yellow-400"
                    )}
                  >
                    {c.isPaid ? "✓ Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
