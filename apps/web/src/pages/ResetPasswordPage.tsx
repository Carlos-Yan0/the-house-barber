// src/pages/ResetPasswordPage.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { Input, Button } from "@/components/ui";
import toast from "react-hot-toast";

const schema = z
  .object({
    password:        z.string().min(8, "Mínimo 8 caracteres").max(128, "Senha muito longa"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();
  const token                 = searchParams.get("token") ?? "";
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [serverError, setServerError]   = useState("");

  useEffect(() => {
    if (!token) navigate("/esqueci-senha", { replace: true });
  }, [token, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await authApi.resetPassword(token, data.password);
      toast.success("Senha redefinida! Faça login.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      setServerError(err.response?.data?.error ?? "Erro ao redefinir senha. Tente novamente.");
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <Logo className="mb-8" />

        <div className="w-14 h-14 rounded-2xl bg-gold-600/15 border border-gold-600/25 flex items-center justify-center mb-5">
          <KeyRound size={24} className="text-gold-500" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-white mb-2">Nova senha</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-8">
          Escolha uma senha forte com pelo menos 8 caracteres.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Nova senha */}
          <div className="relative">
            <Input
              label="Nova senha"
              type={showPass ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-[38px] text-[var(--text-muted)] hover:text-white transition-colors"
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Confirmar senha */}
          <div className="relative">
            <Input
              label="Confirmar nova senha"
              type={showConfirm ? "text" : "password"}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-[38px] text-[var(--text-muted)] hover:text-white transition-colors"
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Erro do servidor */}
          {serverError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400 leading-relaxed">{serverError}</p>
            </div>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-2">
            Redefinir senha
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}