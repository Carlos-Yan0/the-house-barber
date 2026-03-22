// src/pages/ForgotPasswordPage.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { Input, Button } from "@/components/ui";

const schema = z.object({
  email: z.string().email("E-mail inválido").trim(),
});
type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await authApi.forgotPassword(data.email.toLowerCase());
    } catch {
      // Silently ignore — always show success to not leak if email exists
    } finally {
      setSentEmail(data.email);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <Logo className="mb-8" />

        {!submitted ? (
          <>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold text-white mb-2">
                Esqueceu a senha?
              </h1>
              <p className="text-[var(--text-secondary)] text-sm">
                Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                leftIcon={<Mail size={15} />}
                error={errors.email?.message}
                {...register("email")}
              />
              <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-2">
                Enviar link de redefinição
              </Button>
            </form>
          </>
        ) : (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-5">
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-white mb-2">E-mail enviado!</h1>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              Se <strong className="text-white">{sentEmail}</strong> estiver cadastrado,
              você receberá as instruções em breve.
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-3">
              Não recebeu? Verifique a pasta de spam ou{" "}
              <button onClick={() => setSubmitted(false)} className="text-gold-400 hover:text-gold-300 underline transition-colors">
                tente novamente
              </button>.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <ArrowLeft size={12} /> Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}