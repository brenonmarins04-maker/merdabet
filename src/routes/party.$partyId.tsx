import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, PartyPopper, Plus, ThumbsUp } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import type { Bet, PendingBet } from "@/lib/mock-data";

export const Route = createFileRoute("/party/$partyId")({
  head: () => ({ meta: [{ title: "MerdaBet — Festa" }] }),
  component: PartyPage,
});

function PartyPage() {
  const { partyId } = Route.useParams();
  const { parties, pending, bets, confirmAttendance, approvePending, suggestBet } =
    useApp();
  const party = parties.find((p) => p.id === partyId);

  const [suggestOpen, setSuggestOpen] = useState(false);

  if (!party) {
    return (
      <div className="min-h-dvh">
        <AppHeader back="/" title="Festa não encontrada" />
      </div>
    );
  }

  const startDate = new Date(party.start);
  const beforeStart = Date.now() < startDate.getTime();

  const partyPending = pending.filter((p) => p.partyId === partyId);
  const partyBets = bets.filter((b) => b.partyId === partyId);

  return (
    <div className="min-h-dvh pb-32">
      <AppHeader back={`/group/${party.groupId}`} title={party.name} />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-5">
        <section className="bg-party-gradient relative overflow-hidden rounded-2xl p-5">
          <PartyPopper className="absolute -right-4 -top-4 h-24 w-24 opacity-25" />
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">
            {startDate.toLocaleString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-white">
            {party.name}
          </h2>
        </section>

        {beforeStart && !party.attending && (
          <button
            onClick={() => {
              confirmAttendance(party.id);
              toast.success("Presença confirmada! +50 contos 🪙");
            }}
            className="animate-pulse-glow flex h-20 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--neon-green)] text-lg font-black uppercase tracking-wide text-zinc-950"
          >
            🎉 Vou na festa!
          </button>
        )}
        {party.attending && (
          <div className="rounded-2xl border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 p-4 text-center text-sm font-black uppercase tracking-wider text-[color:var(--neon-green)]">
            ✓ Presença Confirmada
          </div>
        )}

        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-secondary p-1">
            <TabsTrigger value="pending" className="text-xs font-bold uppercase">
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="live" className="text-xs font-bold uppercase">
              Ao Vivo
            </TabsTrigger>
            <TabsTrigger value="vote" className="text-xs font-bold uppercase">
              Votação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {partyPending.length === 0 && <Empty msg="Nenhuma merda na fila ainda." />}
            {partyPending.map((pb) => (
              <PendingCard key={pb.id} pb={pb} onApprove={approvePending} />
            ))}
          </TabsContent>

          <TabsContent value="live" className="mt-4 space-y-3">
            {partyBets.length === 0 && <Empty msg="Sem apostas rolando." />}
            {partyBets.map((b) => (
              <BetCard key={b.id} bet={b} />
            ))}
          </TabsContent>

          <TabsContent value="vote" className="mt-4 space-y-3">
            {partyBets.length === 0 && <Empty msg="Nada pra votar ainda." />}
            {partyBets.map((b) => (
              <VoteCard key={b.id} bet={b} />
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <button
        onClick={() => setSuggestOpen(true)}
        className="glow-purple fixed bottom-6 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 text-sm font-black uppercase tracking-wider text-primary-foreground"
      >
        <Plus className="h-5 w-5" />
        Sugerir uma Merda
      </button>

      <SuggestDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        onSuggest={(desc, oFor, oAgainst) => {
          suggestBet(party.id, desc, oFor, oAgainst);
          toast.success("Sua merda foi sugerida!");
        }}
      />
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

function PendingCard({
  pb,
  onApprove,
}: {
  pb: PendingBet;
  onApprove: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-base font-bold leading-snug">{pb.description}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          disabled={pb.approvedByMe}
          onClick={() => onApprove(pb.id)}
          className="h-11 flex-1 gap-2 bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
        >
          <ThumbsUp className="h-4 w-4" />
          {pb.approvedByMe ? "Aprovado" : "Faz Sentido"}
        </Button>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Aprovações
          </p>
          <p className="text-lg font-black tabular-nums text-neon-green">
            {pb.approvals}/{pb.needed}
          </p>
        </div>
      </div>
    </div>
  );
}

function BetCard({ bet }: { bet: Bet }) {
  const { placeBet, cashOut, spend } = useApp();
  const [open, setOpen] = useState<null | "for" | "against">(null);
  const [amt, setAmt] = useState(5);

  const cashOutValue = bet.placed
    ? Math.max(
        1,
        Math.round(
          bet.placed.amount *
            (bet.placed.side === "for" ? bet.oddFor : bet.oddAgainst) *
            0.7,
        ),
      )
    : 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-base font-bold leading-snug">{bet.description}</p>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-[color:var(--neon-green)]/10 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--neon-green)]">
            A Favor
          </p>
          <p className="text-2xl font-black tabular-nums text-neon-green">
            {bet.oddFor.toFixed(2)}x
          </p>
        </div>
        <div className="rounded-xl bg-[color:var(--neon-red)]/10 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--neon-red)]">
            Contra
          </p>
          <p className="text-2xl font-black tabular-nums text-neon-red">
            {bet.oddAgainst.toFixed(2)}x
          </p>
        </div>
      </div>

      {bet.placed ? (
        <Button
          className="h-12 w-full bg-[color:var(--neon-yellow)] font-black uppercase tracking-wide text-zinc-950 hover:bg-[color:var(--neon-yellow)]/90"
          onClick={() => {
            const v = cashOut(bet.id);
            toast.success(`Cash Out: +${v} contos 💰`);
          }}
        >
          Cash Out — Retirar {cashOutValue} contos
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => {
              setOpen("for");
              setAmt(5);
            }}
            className="h-12 bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
          >
            Apostar A Favor
          </Button>
          <Button
            onClick={() => {
              setOpen("against");
              setAmt(5);
            }}
            className="h-12 bg-[color:var(--neon-red)] font-black text-white hover:bg-[color:var(--neon-red)]/90"
          >
            Apostar Contra
          </Button>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Apostar {open === "for" ? "a favor" : "contra"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{bet.description}</p>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-[color:var(--coin)]" />
            <Input
              type="number"
              min={1}
              value={amt}
              onChange={(e) => setAmt(Math.max(1, Number(e.target.value) || 1))}
              className="h-12 text-base font-bold tabular-nums"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Retorno potencial:{" "}
            <span className="font-black text-[color:var(--neon-green)]">
              {(
                amt * (open === "for" ? bet.oddFor : bet.oddAgainst)
              ).toFixed(2)}{" "}
              contos
            </span>
          </p>
          <DialogFooter>
            <Button
              className="h-12 w-full font-bold"
              onClick={() => {
                if (!open) return;
                if (!spend(amt)) {
                  toast.error("Sem contos suficientes");
                  return;
                }
                placeBet(bet.id, open, amt);
                toast.success(`Aposta de ${amt} contos confirmada`);
                setOpen(null);
              }}
            >
              Confirmar Aposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VoteCard({ bet }: { bet: Bet }) {
  const { voteBet } = useApp();
  const voted = !!bet.voted;
  return (
    <div
      className={
        "rounded-2xl border border-border/60 bg-card p-4 transition " +
        (voted ? "opacity-50" : "")
      }
    >
      <p className="text-base font-bold leading-snug">{bet.description}</p>
      {voted ? (
        <p className="mt-3 text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
          Seu voto foi registrado
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            className="h-12 bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
            onClick={() => {
              voteBet(bet.id, "happened");
              toast.success("Voto registrado: aconteceu");
            }}
          >
            ACONTECEU
          </Button>
          <Button
            className="h-12 bg-[color:var(--neon-red)] font-black text-white hover:bg-[color:var(--neon-red)]/90"
            onClick={() => {
              voteBet(bet.id, "not");
              toast.success("Voto registrado: não rolou");
            }}
          >
            NÃO ACONTECEU
          </Button>
        </div>
      )}
    </div>
  );
}

function SuggestDialog({
  open,
  onOpenChange,
  onSuggest,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuggest: (desc: string, oFor: number, oAgainst: number) => void;
}) {
  const [desc, setDesc] = useState("");
  const [oFor, setOFor] = useState(1.8);
  const [oAgainst, setOAgainst] = useState(2);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sugerir uma merda</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Ex: Fulano vai dormir antes da meia-noite"
            className="h-12"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold uppercase text-[color:var(--neon-green)]">
                Odd A Favor
              </label>
              <Input
                type="number"
                step={0.05}
                min={1.01}
                value={oFor}
                onChange={(e) => setOFor(Number(e.target.value) || 1.01)}
                className="h-12 font-black tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[color:var(--neon-red)]">
                Odd Contra
              </label>
              <Input
                type="number"
                step={0.05}
                min={1.01}
                value={oAgainst}
                onChange={(e) => setOAgainst(Number(e.target.value) || 1.01)}
                className="h-12 font-black tabular-nums"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (!desc.trim()) {
                toast.error("Descreve a merda aí");
                return;
              }
              onSuggest(desc.trim(), oFor, oAgainst);
              setDesc("");
              onOpenChange(false);
            }}
          >
            Enviar para validação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
