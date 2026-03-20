// src/pages/RegisterPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Logo } from "@/components/ui/Logo";
import { Input, Button } from "@/components/ui";
import toast from "react-hot-toast";

const schema = z
  .object({
    name: z.string().min(2, "Nome muito curto"),
    email: z.string().email("E-mail inválido"),
    phone: z.string().optional(),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.register({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
      });
      const { user, token } = res.data;

      // Register returns token but not refreshToken; redirect to login
      toast.success("Conta criada! Faça login para continuar.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erro ao criar conta");
    }
  };

  return (
    <div className="min-h-dvh flex flex-col px-6 py-10">
      <Logo className="mb-10" />

      <div className="w-full max-w-sm mx-auto animate-slide-up">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-white mb-2">
            Criar conta
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Já tem uma conta?{" "}
            <Link
              to="/login"
              className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
            >
              Fazer login
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome completo"
            placeholder="João da Silva"
            autoComplete="name"
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="WhatsApp (opcional)"
            type="tel"
            placeholder="47999999999"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />

          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            error={errors.password?.message}
            hint="Use pelo menos 8 caracteres"
            {...register("password")}
          />

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="w-full mt-2"
          >
            Criar conta
          </Button>
        </form>
      </div>
    </div>
  );
}
