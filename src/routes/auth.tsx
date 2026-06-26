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

function AuthPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!u.trim() || !p.trim()) {
      toast.error("Preenche aí, parça");
      return;
    }
    login(u.trim());
    toast.success(`Bem-vindo, ${u}! 🪙 +50 contos`);
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
          <p className="mt-3 text-sm text-muted-foreground">
            As melhores merdas da festa pagam bem.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Usuário
            </label>
            <Input
              value={u}
              onChange={(e) => setU(e.target.value)}
              placeholder="seu_apelido"
              className="h-12 text-base"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Senha
            </label>
            <Input
              type="password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              placeholder="••••••"
              className="h-12 text-base"
            />
          </div>

          <Button
            type="submit"
            className="glow-purple h-14 w-full bg-primary text-base font-black uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
          >
            Entrar / Criar Conta
          </Button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Você começa com <span className="font-black text-[color:var(--coin)]">50 contos</span> de bônus.
          </p>
        </form>
      </div>
    </main>
  );
}
