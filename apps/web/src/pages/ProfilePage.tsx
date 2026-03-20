// src/pages/ProfilePage.tsx
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { LogOut, User, Mail, Phone, Shield } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { Input, Button } from "@/components/ui";
import { getInitials } from "@/lib/utils";
import toast from "react-hot-toast";

export function ProfilePage() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    logout();
    navigate("/");
    toast.success("Até logo!");
  };

  const roleName =
    user?.role === "ADMIN"
      ? "Administrador"
      : user?.role === "BARBER"
      ? "Barbeiro"
      : "Cliente";

  return (
    <div className="page-container animate-fade-in">
      <h1 className="font-display text-2xl font-semibold text-white mb-6">
        Meu Perfil
      </h1>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gold-600/15 border border-gold-600/25 flex items-center justify-center text-gold-500 font-display font-semibold text-2xl">
          {user ? getInitials(user.name) : "?"}
        </div>
        <div>
          <h2 className="font-display font-semibold text-white text-xl">
            {user?.name}
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-400 bg-gold-600/10 border border-gold-600/20 px-2.5 py-1 rounded-lg mt-1">
            <Shield size={11} />
            {roleName}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="card divide-y divide-dark-50 mb-6">
        <div className="p-4 flex items-center gap-3">
          <User size={16} className="text-[var(--text-muted)]" />
          <div>
            <p className="section-label">Nome</p>
            <p className="text-sm text-white">{user?.name}</p>
          </div>
        </div>
        <div className="p-4 flex items-center gap-3">
          <Mail size={16} className="text-[var(--text-muted)]" />
          <div>
            <p className="section-label">E-mail</p>
            <p className="text-sm text-white">{user?.email}</p>
          </div>
        </div>
        {user?.phone && (
          <div className="p-4 flex items-center gap-3">
            <Phone size={16} className="text-[var(--text-muted)]" />
            <div>
              <p className="section-label">WhatsApp</p>
              <p className="text-sm text-white">{user.phone}</p>
            </div>
          </div>
        )}
      </div>

      <Button
        variant="danger"
        className="w-full"
        icon={<LogOut size={16} />}
        onClick={handleLogout}
      >
        Sair da conta
      </Button>
    </div>
  );
}
