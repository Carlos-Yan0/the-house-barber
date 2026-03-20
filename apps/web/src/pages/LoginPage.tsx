// src/pages/LoginPage.tsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Scissors } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Logo } from "@/components/ui/Logo";
import { Input, Button } from "@/components/ui";
import toast from "react-hot-toast";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from ?? "/agendar";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data.email, data.password);
      const { user, token, refreshToken } = res.data;
      setAuth(user, token, refreshToken);
      toast.success(`Bem-vindo, ${user.name.split(" ")[0]}!`);

      // Role-based redirect
      if (user.role === "ADMIN") navigate("/admin/dashboard");
      else if (user.role === "BARBER") navigate("/barbeiro/dashboard");
      else navigate(from);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erro ao fazer login");
    }
  };

  return (
    <div className="min-h-dvh flex">
      {/* Left panel - decorative (hidden on mobile) */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12 bg-dark-400 border-r border-dark-50 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, #d4920f 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Gold accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gold-gradient opacity-60" />

        <Logo size="lg" asLink={false} />

        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-dark-300 border border-dark-50 flex items-center justify-center mb-6">
            <Scissors size={28} className="text-gold-500" />
          </div>
          <blockquote className="font-display text-3xl font-semibold text-white leading-snug mb-4">
            "Onde o estilo encontra a{" "}
            <span className="text-gold-gradient">precisão.</span>"
          </blockquote>
          <div>
            <p className="text-white font-medium text-sm">The House Barber</p>
            <p className="text-[var(--text-muted)] text-sm">
              Sistema de agendamento
            </p>
          </div>
        </div>

        <p className="text-[var(--text-muted)] text-xs">
          © 2025 The House Barber
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-16 py-12">
        {/* Mobile logo */}
        <div className="md:hidden mb-10">
          <Logo size="lg" />
        </div>

        <div className="w-full max-w-sm mx-auto animate-slide-up">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-semibold text-white mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-[var(--text-secondary)] text-sm">
              Não tem uma conta?{" "}
              <Link
                to="/register"
                className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <div>
              <Input
                label="Senha"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition-colors"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-6"
            >
              Entrar
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              ← Voltar para agendamentos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
