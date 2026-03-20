// src/pages/admin/AdminReportsPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BarChart3, DollarSign, TrendingUp, CheckCircle } from "lucide-react";
import { adminApi } from "@/lib/api";
import { StatsCard, Button, Spinner, EmptyState, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

export function AdminReportsPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const start = format(new Date(month + "-01"), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date(month + "-01")), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue", month],
    queryFn: () =>
      adminApi.revenue({ start, end }).then((r) => r.data),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => adminApi.payCommission(id),
    onSuccess: () => {
      toast.success("Comissão marcada como paga!");
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
    },
  });

  const byBarber: Record<string, { revenue: number; commissions: number; count: number }> =
    data?.byBarber ?? {};

  const byService: Record<string, { revenue: number; count: number }> =
    data?.byService ?? {};

  const comandas: any[] = data?.comandas ?? [];
  const pendingCommissions = comandas.filter(
    (c) => c.commission && !c.commission.isPaid
  );

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Relatórios
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Receitas e comissões
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input-field text-xs py-2 w-36"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Revenue stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatsCard
              label="Receita bruta"
              value={formatCurrency(data?.totalRevenue ?? 0)}
              icon={<DollarSign size={16} />}
            />
            <StatsCard
              label="Receita líquida"
              value={formatCurrency(data?.netRevenue ?? 0)}
              icon={<TrendingUp size={16} />}
            />
            <StatsCard
              label="Total comissões"
              value={formatCurrency(data?.totalCommissions ?? 0)}
              icon={<CheckCircle size={16} />}
            />
            <StatsCard
              label="Atendimentos"
              value={comandas.length}
              icon={<BarChart3 size={16} />}
            />
          </div>

          {/* By barber */}
          {Object.keys(byBarber).length > 0 && (
            <div className="mb-6">
              <h2 className="font-display font-semibold text-white mb-3">
                Por barbeiro
              </h2>
              <div className="space-y-2">
                {Object.entries(byBarber).map(([name, data]) => (
                  <div key={name} className="card-elevated p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">{name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {data.count} atendimentos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gold-400 text-sm">
                          {formatCurrency(data.revenue)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Comissão: {formatCurrency(data.commissions)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By service */}
          {Object.keys(byService).length > 0 && (
            <div className="mb-6">
              <h2 className="font-display font-semibold text-white mb-3">
                Por serviço
              </h2>
              <div className="space-y-2">
                {Object.entries(byService)
                  .sort(([, a], [, b]) => b.revenue - a.revenue)
                  .map(([name, data]) => (
                    <div key={name} className="card p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">{name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {data.count}x realizado
                        </p>
                      </div>
                      <p className="font-medium text-gold-400 text-sm">
                        {formatCurrency(data.revenue)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Pending commissions */}
          {pendingCommissions.length > 0 && (
            <div>
              <h2 className="font-display font-semibold text-white mb-3">
                Comissões pendentes ({pendingCommissions.length})
              </h2>
              <div className="space-y-2">
                {pendingCommissions.map((c: any) => (
                  <div key={c.id} className="card-elevated p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white text-sm">
                          {c.appointment?.barberProfile?.user?.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {c.appointment?.service?.name} ·{" "}
                          {c.closedAt && formatDate(c.closedAt)}
                        </p>
                        <p className="text-sm font-semibold text-gold-400 mt-1">
                          {formatCurrency(c.commission?.commissionAmount ?? 0)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={payMutation.isPending}
                        onClick={() =>
                          payMutation.mutate(c.commission.id)
                        }
                      >
                        Marcar pago
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
