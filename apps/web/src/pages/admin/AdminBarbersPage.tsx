// src/pages/admin/AdminBarbersPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, Percent } from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button, EmptyState, Spinner, Modal, Input, Badge } from "@/components/ui";
import { getInitials } from "@/lib/utils";
import type { User } from "@/types";
import toast from "react-hot-toast";

export function AdminBarbersPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    commissionRate: 50,
  });

  const { data: barbers = [], isLoading } = useQuery({
    queryKey: ["admin-barbers"],
    queryFn: () =>
      adminApi.listUsers("BARBER").then((r) => r.data as User[]),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createBarber({
        ...form,
        commissionRate: form.commissionRate / 100,
      }),
    onSuccess: () => {
      toast.success("Barbeiro criado!");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setModal(false);
      setForm({ name: "", email: "", password: "", phone: "", commissionRate: 50 });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Erro ao criar"),
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Barbeiros
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Gerencie a equipe da barbearia
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setModal(true)}>
          Novo barbeiro
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : barbers.length === 0 ? (
        <EmptyState
          icon={<UserCheck size={22} />}
          title="Nenhum barbeiro cadastrado"
          action={
            <Button size="sm" onClick={() => setModal(true)}>
              Cadastrar barbeiro
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {barbers.map((barber: any) => (
            <div key={barber.id} className="card-elevated p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gold-600/15 border border-gold-600/25 flex items-center justify-center text-gold-500 font-display font-semibold text-base">
                  {getInitials(barber.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm truncate">
                      {barber.name}
                    </p>
                    <Badge variant={barber.isActive ? "green" : "gray"}>
                      {barber.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {barber.email}
                  </p>
                  {barber.barberProfile && (
                    <div className="flex items-center gap-1.5 text-xs text-gold-400 mt-1">
                      <Percent size={11} />
                      {Math.round(barber.barberProfile.commissionRate * 100)}%
                      de comissão
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Barber Modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="Novo barbeiro"
      >
        <div className="space-y-4">
          <Input
            label="Nome completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome do barbeiro"
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="barbeiro@email.com"
          />
          <Input
            label="Senha inicial"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
          />
          <Input
            label="WhatsApp (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="47999999999"
          />
          <div>
            <label className="section-label block mb-1.5">
              Taxa de comissão: {form.commissionRate}%
            </label>
            <input
              type="range"
              min={20}
              max={80}
              step={5}
              value={form.commissionRate}
              onChange={(e) =>
                setForm({ ...form, commissionRate: Number(e.target.value) })
              }
              className="w-full accent-gold-500"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>20%</span>
              <span>80%</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.email || form.password.length < 8}
            >
              Criar barbeiro
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
