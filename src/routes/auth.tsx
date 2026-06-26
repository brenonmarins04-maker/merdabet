import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "MerdaBet — Entrar" },
      { name: "description", content: "Entre no MerdaBet e aposte nas merdas das festas." },
    ],
  }),
  component: AuthPage,
});

const USERNAME_RE = /^[a-z0-9_]+$/;

function sanitizeUsername(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function AuthPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [usernameErr, setUsernameErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  function handleUsernameChange(raw: string) {
    const clean = sanitizeUsername(raw);
    setU(clean);
    setUsernameErr("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setUsernameErr("");
    setPasswordErr("");

    if (!u) {
      setUsernameErr("Preenche o usuário.");
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setUsernameErr("Só letras minúsculas, números e _ (sem espaço).");
      return;
    }
    if (u.length < 3) {
      setUsernameErr("Mínimo 3 caracteres.");
      return;
    }
    if (!p) {
      setPasswordErr("Preenche a senha.");
      return;
    }
    if (p.length < 4) {
      setPasswordErr("Mínimo 4 caracteres.");
      return;
    }

    const err = await login(u, p);
    if (err) {
      setPasswordErr(err);
      return;
    }

    toast.success(`Bem-vindo, ${u}! 🪙 +50 conto`);
    navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.4em] text-muted-foreground">
            Aposte. Confraterniza. Lucre.
          </p>
          <h1 className="text-5xl font-black tracking-tighter text-neon-purple">
            MerdaBet
          </h1>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3">
            <span className="text-xl">🤮</span>
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">Luizinho tomar 5 beats e gorfar</span>{" "}
              <span className="font-black text-green-400">ODD 1.2</span>
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Usuário
            </label>
            <Input
              value={u}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="seu_apelido"
              className={`h-12 text-base ${usernameErr ? "border-red-500" : ""}`}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {usernameErr && (
              <p className="text-xs font-bold text-red-400">{usernameErr}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Só minúsculas, números e _ · sem espaço
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Senha
            </label>
            <Input
              type="password"
              value={p}
              onChange={(e) => { setP(e.target.value); setPasswordErr(""); }}
              placeholder="••••••"
              className={`h-12 text-base ${passwordErr ? "border-red-500" : ""}`}
              autoComplete="current-password"
            />
            {passwordErr && (
              <p className="text-xs font-bold text-red-400">{passwordErr}</p>
            )}
          </div>

          <Button
            type="submit"
            className="glow-purple h-14 w-full bg-primary text-base font-black uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
          >
            Entrar / Criar Conta
          </Button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Você começa com <span className="font-black text-green-400">50 conto</span> de bônus.
          </p>
        </form>
      </div>
    </main>
  );
}
