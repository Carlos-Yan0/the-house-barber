// src/pages/admin/AdminBarbersPage.tsx
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, Percent, Edit2, PowerOff, Power } from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button, EmptyState, Spinner, Modal, Input, Badge } from "@/components/ui";
import { onlyDigits } from "../../lib/Inputhandlers";
import type { User } from "@/types";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ── Schemas ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  name:           z.string().min(2, "Nome muito curto").max(100, "Nome muito longo").trim(),
  email:          z.string().email("E-mail inválido").trim(),
  password:       z.string().min(8, "Mínimo 8 caracteres").max(128, "Senha muito longa"),
  phone:          z.string().max(20, "Telefone inválido").optional().or(z.literal("")),
  commissionRate: z.number().min(20, "Mínimo 20%").max(80, "Máximo 80%"),
});

const editSchema = z.object({
  name:           z.string().min(2, "Nome muito curto").max(100).trim(),
  email:          z.string().email("E-mail inválido").trim(),
  phone:          z.string().max(20, "Telefone inválido").optional().or(z.literal("")),
  commissionRate: z.number().min(20, "Mínimo 20%").max(80, "Máximo 80%"),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

export function AdminBarbersPage() {
  const qc = useQueryClient();

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [toggleModal, setToggleModal] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", phone: "", commissionRate: 50 },
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", email: "", phone: "", commissionRate: 50 },
  });

  const { data: barbers = [], isLoading } = useQuery({
    queryKey: ["admin-barbers"],
    queryFn: () => adminApi.listUsers("BARBER").then((r) => r.data as User[]),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) =>
      adminApi.createBarber({
        ...data,
        phone: data.phone || undefined,
        commissionRate: data.commissionRate / 100,
      }),
    onSuccess: () => {
      toast.success("Barbeiro criado!");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setCreateModal(false);
      createForm.reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Erro ao criar"),
  });

  const editMutation = useMutation({
    mutationFn: (data: EditForm) =>
      adminApi.updateBarber(editingId!, {
        name:  data.name,
        email: data.email,
        phone: data.phone || undefined,
        commissionRate: data.commissionRate / 100,
      }),
    onSuccess: () => {
      toast.success("Barbeiro atualizado!");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setEditModal(false);
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Erro ao atualizar"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleUserActive(id),
    onSuccess: () => {
      toast.success(toggleTarget?.isActive ? "Barbeiro inativado" : "Barbeiro reativado");
      qc.invalidateQueries({ queryKey: ["admin-barbers"] });
      setToggleModal(false);
      setToggleTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Erro ao atualizar status"),
  });

  const openEdit = (barber: any) => {
    setEditingId(barber.id);
    editForm.reset({
      name:           barber.name,
      email:          barber.email,
      phone:          barber.phone ?? "",
      commissionRate: Math.round((barber.barberProfile?.commissionRate ?? 0.5) * 100),
    });
    setEditModal(true);
  };

  const openToggle = (barber: any) => {
    setToggleTarget({ id: barber.id, name: barber.name, isActive: barber.isActive });
    setToggleModal(true);
  };

  // Reutilizável: campo de telefone com inputMode e onlyDigits
  const PhoneField = ({ form }: { form: any }) => (
    <Input
      label="WhatsApp (opcional)"
      type="text"
      inputMode="numeric"
      placeholder="47999999999"
      onKeyDown={onlyDigits}
      error={form.formState.errors.phone?.message}
      {...form.register("phone")}
    />
  );

  // Reutilizável: slider de comissão
  const CommissionSlider = ({ form }: { form: any }) => (
    <Controller
      control={form.control}
      name="commissionRate"
      render={({ field, fieldState }) => (
        <div>
          <label className="section-label block mb-1.5">
            Taxa de comissão: {field.value}%
          </label>
          <input
            type="range" min={20} max={80} step={5}
            value={field.value}
            onChange={(e) => field.onChange(Number(e.target.value))}
            className="w-full accent-gold-500"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>20%</span><span>80%</span>
          </div>
          {fieldState.error && <p className="text-xs text-red-400 mt-1">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Barbeiros</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Gerencie a equipe da barbearia</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateModal(true)}>
          Novo barbeiro
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : barbers.length === 0 ? (
        <EmptyState
          icon={<UserCheck size={22} />}
          title="Nenhum barbeiro cadastrado"
          action={<Button size="sm" onClick={() => setCreateModal(true)}>Cadastrar barbeiro</Button>}
        />
      ) : (
        <div className="space-y-3">
          {(barbers as any[]).map((barber) => (
            <div key={barber.id} className={`card-elevated p-4 transition-all ${!barber.isActive && "opacity-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm">{barber.name}</p>
                    {!barber.isActive && <Badge variant="gray">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{barber.email}</p>
                  {barber.barberProfile && (
                    <div className="flex items-center gap-1 text-xs text-gold-400 mt-1.5">
                      <Percent size={11} />
                      {Math.round(barber.barberProfile.commissionRate * 100)}% de comissão
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(barber)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-dark-50/60 transition-all">
                    <Edit2 size={15} />
                  </button>
                  {barber.isActive ? (
                    <button onClick={() => openToggle(barber)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <PowerOff size={15} />
                    </button>
                  ) : (
                    <button onClick={() => openToggle(barber)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                      <Power size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: criar ── */}
      <Modal isOpen={createModal} onClose={() => { setCreateModal(false); createForm.reset(); }} title="Novo barbeiro">
        <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4" noValidate>
          <Input
            label="Nome completo"
            placeholder="Nome do barbeiro"
            error={createForm.formState.errors.name?.message}
            {...createForm.register("name")}
          />
          <Input
            label="E-mail"
            type="email"
            placeholder="barbeiro@email.com"
            error={createForm.formState.errors.email?.message}
            {...createForm.register("email")}
          />
          <Input
            label="Senha inicial"
            type="password"
            placeholder="Mínimo 8 caracteres"
            error={createForm.formState.errors.password?.message}
            {...createForm.register("password")}
          />
          <PhoneField form={createForm} />
          <CommissionSlider form={createForm} />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => { setCreateModal(false); createForm.reset(); }}>Cancelar</Button>
            <Button className="flex-1" loading={createMutation.isPending} type="submit">Criar barbeiro</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: editar ── */}
      <Modal isOpen={editModal} onClose={() => { setEditModal(false); setEditingId(null); }} title="Editar barbeiro">
        <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4" noValidate>
          <Input
            label="Nome completo"
            placeholder="Nome do barbeiro"
            error={editForm.formState.errors.name?.message}
            {...editForm.register("name")}
          />
          <Input
            label="E-mail"
            type="email"
            placeholder="barbeiro@email.com"
            error={editForm.formState.errors.email?.message}
            {...editForm.register("email")}
          />
          <PhoneField form={editForm} />
          <CommissionSlider form={editForm} />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" type="button" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={editMutation.isPending} type="submit">Salvar alterações</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: toggle ── */}
      <Modal
        isOpen={toggleModal}
        onClose={() => setToggleModal(false)}
        title={toggleTarget?.isActive ? "Inativar barbeiro" : "Reativar barbeiro"}
        size="sm"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          {toggleTarget?.isActive
            ? <>Tem certeza que deseja inativar <strong className="text-white">{toggleTarget?.name}</strong>? Ele não conseguirá fazer login e não aparecerá para agendamentos.</>
            : <>Deseja reativar <strong className="text-white">{toggleTarget?.name}</strong>? Ele voltará a aparecer para agendamentos.</>
          }
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setToggleModal(false)}>Cancelar</Button>
          <Button
            variant={toggleTarget?.isActive ? "danger" : "gold"}
            className="flex-1"
            loading={toggleMutation.isPending}
            onClick={() => toggleTarget && toggleMutation.mutate(toggleTarget.id)}
          >
            {toggleTarget?.isActive ? "Inativar" : "Reativar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}