// src/pages/admin/AdminServicesPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Clock, DollarSign } from "lucide-react";
import { servicesApi } from "@/lib/api";
import {
  Button,
  EmptyState,
  Spinner,
  Modal,
  Input,
  Badge,
} from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";
import type { Service } from "@/types";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  name: "",
  description: "",
  duration: 30,
  price: 0,
  isActive: true,
  sortOrder: 0,
};

export function AdminServicesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services-admin"],
    queryFn: () =>
      servicesApi.list(true).then((r) => r.data as Service[]),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? servicesApi.update(editing.id, form)
        : servicesApi.create(form),
    onSuccess: () => {
      toast.success(editing ? "Serviço atualizado!" : "Serviço criado!");
      qc.invalidateQueries({ queryKey: ["services-admin"] });
      qc.invalidateQueries({ queryKey: ["services"] });
      closeModal();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      toast.success("Serviço desativado");
      qc.invalidateQueries({ queryKey: ["services-admin"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      duration: s.duration,
      price: Number(s.price),
      isActive: s.isActive,
      sortOrder: s.sortOrder,
    });
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Serviços
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Gerencie os serviços oferecidos
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Novo serviço
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          title="Nenhum serviço"
          description="Crie serviços para que os clientes possam agendar."
          action={
            <Button size="sm" onClick={openCreate}>
              Criar primeiro serviço
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <div
              key={s.id}
              className={cn(
                "card-elevated p-4 transition-all",
                !s.isActive && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm">{s.name}</p>
                    {!s.isActive && (
                      <Badge variant="gray">Inativo</Badge>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {s.description}
                    </p>
                  )}
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                      <Clock size={11} /> {s.duration}min
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gold-400 font-medium">
                      <DollarSign size={11} />
                      {formatCurrency(s.price)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-dark-50/60 transition-all"
                  >
                    <Edit2 size={15} />
                  </button>
                  {s.isActive && (
                    <button
                      onClick={() => deleteMutation.mutate(s.id)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modal}
        onClose={closeModal}
        title={editing ? "Editar serviço" : "Novo serviço"}
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Corte de Cabelo"
          />
          <Input
            label="Descrição (opcional)"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            placeholder="Breve descrição do serviço"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duração (minutos)"
              type="number"
              min={5}
              max={480}
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: Number(e.target.value) })
              }
            />
            <Input
              label="Preço (R$)"
              type="number"
              min={0}
              step={0.01}
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </div>
          <Input
            label="Ordem de exibição"
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) =>
              setForm({ ...form, sortOrder: Number(e.target.value) })
            }
          />

          <div className="flex items-center gap-3 py-1">
            <button
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={cn(
                "w-10 h-5 rounded-full transition-all duration-200 relative",
                form.isActive ? "bg-gold-600" : "bg-dark-50"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all",
                  form.isActive ? "left-5" : "left-0.5"
                )}
              />
            </button>
            <span className="text-sm text-[var(--text-secondary)]">
              Serviço ativo
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || form.price <= 0}
            >
              {editing ? "Salvar" : "Criar serviço"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
