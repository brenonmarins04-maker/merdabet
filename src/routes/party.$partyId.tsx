import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Coins, Lock, PartyPopper, Plus } from "lucide-react";
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
import { isEnded, type Bet, type PendingBet } from "@/lib/mock-data";

export const Route = createFileRoute("/party/$partyId")({
  head: () => ({ meta: [{ title: "MerdaBet — Festa" }] }),
  component: PartyPage,
});

// ─── Odds formatting helpers ──────────────────────────────────────────────────

function displayOdd(digits: string): string {
  if (!digits) return "";
  if (digits.length === 1) return digits + ".";
  if (digits.length === 2) return digits[0] + "." + digits[1];
  if (digits.length === 3) return digits[0] + "." + digits.slice(1);
  return digits.slice(0, 2) + "." + digits.slice(2);
}

function parseOddFromDigits(digits: string): number {
  if (!digits) return 1.01;
  const display = displayOdd(digits).replace(/\.$/, "");
  return Math.max(1.01, parseFloat(display) || 1.01);
}

function digitsFromNumber(n: number): string {
  return Math.round(n * 100).toString();
}

// ─── OddsInput component ──────────────────────────────────────────────────────

function OddsInput({
  value,
  onChange,
  label,
  colorClass = "text-green-400",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  colorClass?: string;
}) {
  const [digits, setDigits] = useState(() => digitsFromNumber(value));
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const next = digits + e.key;
      if (next.length > 4) return;
      const intPart = next.length <= 2 ? parseInt(next) : parseInt(next.slice(0, next.length - 2));
      if (intPart > 99) return;
      setDigits(next);
      onChange(parseOddFromDigits(next));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice(0, -1);
      setDigits(next);
      onChange(parseOddFromDigits(next));
    }
  }

  function handleFocus() {
    setTimeout(() => inputRef.current?.select(), 0);
  }

  return (
    <div>
      <label className={`text-xs font-bold uppercase ${colorClass}`}>{label}</label>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayOdd(digits)}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className={`mt-1 h-12 w-full rounded-md border border-input bg-background px-3 text-center text-xl font-black tabular-nums outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 ${colorClass}`}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PartyPage() {
  const { partyId } = Route.useParams();
  const { parties, pending, bets, votePending, suggestBet, requestDispute, voteDispute } = useApp();
  const party = parties.find((p) => p.id === partyId);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  if (!party) {
    return (
      <div className="min-h-dvh">
        <AppHeader back="/" title="Festa não encontrada" />
      </div>
    );
  }

  const startDate = new Date(party.start);
  const ended = isEnded(party);
  const partyPending = pending.filter((p) => p.partyId === partyId);
  const partyBets = bets.filter((b) => b.partyId === partyId);
  const hasUnvotedPending = partyPending.some((p) => !p.approvedByMe && !p.rejectedByMe);

  return (
    <div className="min-h-dvh pb-32">
      <AppHeader back={`/group/${party.groupId}`} title={party.name} />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-5">

        <section className="bg-party-gradient relative overflow-hidden rounded-2xl p-5">
          <PartyPopper className="absolute -right-4 -top-4 h-24 w-24 opacity-25" />
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">
            {startDate.toLocaleString("pt-BR", {
              weekday: "short", day: "2-digit", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-white">{party.name}</h2>
        </section>

        {ended && (
          <div className="rounded-2xl border-2 border-[color:var(--neon-yellow)] bg-[color:var(--neon-yellow)]/10 p-5 text-center">
            <p className="text-4xl">🗳️</p>
            <p className="mt-2 text-lg font-black uppercase tracking-wide text-[color:var(--neon-yellow)]">
              Festa encerrada!
            </p>
            <p className="mt-1 text-sm font-bold text-[color:var(--neon-yellow)]/80">
              Vai na aba ACONTECEU? e registra o que aconteceu!
            </p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-secondary p-1">
            <TabsTrigger value="pending" className="relative text-xs font-bold uppercase">
              Pendentes
              {hasUnvotedPending && <span className="ml-1 text-base">⚠️</span>}
            </TabsTrigger>
            <TabsTrigger
              value="live"
              disabled={hasUnvotedPending}
              className="flex items-center gap-1 text-xs font-bold uppercase disabled:opacity-50"
              onClick={(e) => {
                if (hasUnvotedPending) {
                  e.preventDefault();
                  toast.warning("Vote em todas as pendentes primeiro! ⚠️");
                }
              }}
            >
              {hasUnvotedPending && <Lock className="h-3 w-3" />}
              Ao Vivo
            </TabsTrigger>
            <TabsTrigger value="vote" className="relative text-xs font-bold uppercase">
              ACONTECEU?
              {ended && <span className="ml-1 text-base">🗳️</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {partyPending.length === 0 && <Empty msg="Nenhuma merda na fila ainda." />}
            {partyPending.map((pb) => (
              <PendingCard key={pb.id} pb={pb} onVote={votePending} />
            ))}
          </TabsContent>

          <TabsContent value="live" className="mt-4 space-y-3">
            {hasUnvotedPending ? (
              <div className="rounded-2xl border border-[color:var(--neon-yellow)]/40 bg-[color:var(--neon-yellow)]/10 p-6 text-center">
                <p className="text-4xl">🔒</p>
                <p className="mt-2 font-black uppercase tracking-wide text-[color:var(--neon-yellow)]">
                  Vá nas pendentes e vote primeiro!
                </p>
              </div>
            ) : (
              <>
                {partyBets.length === 0 && <Empty msg="Sem apostas rolando." />}
                {partyBets.map((b) => (
                  <BetCard key={b.id} bet={b} onRequestDispute={requestDispute} onVoteDispute={voteDispute} />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="vote" className="mt-4 space-y-3">
            {ended && (
              <div className="rounded-2xl border-2 border-[color:var(--neon-yellow)] bg-[color:var(--neon-yellow)]/10 p-4 text-center">
                <p className="text-3xl">🗳️</p>
                <p className="mt-1 font-black uppercase tracking-wide text-[color:var(--neon-yellow)]">
                  Vote no que aconteceu!
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--neon-yellow)]/80">
                  São necessários 2 votos para confirmar cada resultado.
                </p>
              </div>
            )}
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
        onSuggest={(desc, odd) => {
          suggestBet(party.id, desc, odd);
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

function PendingCard({ pb, onVote }: { pb: PendingBet; onVote: (id: string, v: "approve" | "reject") => void }) {
  const voted = pb.approvedByMe || pb.rejectedByMe;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      {!voted && (
        <div className="mb-2 flex items-center gap-2 text-[color:var(--neon-yellow)]">
          <span className="text-3xl">⚠️</span>
          <span className="text-xs font-black uppercase tracking-wider">Vote aqui!</span>
        </div>
      )}
      <p className="text-base font-bold leading-snug">{pb.description}</p>

      <div className="mt-3 flex items-center justify-center rounded-xl bg-green-400/10 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-green-400">ODD</p>
        <p className="ml-2 text-2xl font-black tabular-nums text-green-400">{pb.odd.toFixed(2)}x</p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {voted ? (
          <p className="flex-1 text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
            {pb.approvedByMe ? "✓ Votou: faz sentido" : "✗ Votou: não faz sentido"}
          </p>
        ) : (
          <>
            <Button
              onClick={() => { onVote(pb.id, "approve"); toast.success("Votou: faz sentido 👍"); }}
              className="h-11 flex-1 bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
            >
              👍 Faz Sentido
            </Button>
            <Button
              onClick={() => { onVote(pb.id, "reject"); toast.success("Votou: não faz sentido 👎"); }}
              className="h-11 flex-1 bg-[color:var(--neon-red)] font-black text-white hover:bg-[color:var(--neon-red)]/90"
            >
              👎 Não Faz
            </Button>
          </>
        )}
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aprovações</p>
          <p className="text-lg font-black tabular-nums text-green-400">{pb.approvals}/{pb.needed}</p>
        </div>
      </div>
    </div>
  );
}

function BetCard({
  bet,
  onRequestDispute,
  onVoteDispute,
}: {
  bet: Bet;
  onRequestDispute: (betId: string, type: "change_odd" | "delete", newOdd?: number) => void;
  onVoteDispute: (betId: string, vote: "approve" | "reject") => void;
}) {
  const { placeBet, spend } = useApp();
  const [betOpen, setBetOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [amt, setAmt] = useState("5");

  const canDispute = bet.disputeStatus === "none";
  const disputePending = bet.disputeStatus === "pending";
  const disputeRejected = bet.disputeStatus === "rejected";

  return (
    <div className="relative space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      {/* Small red dispute trigger button */}
      {canDispute && (
        <button
          onClick={() => setDisputeOpen(true)}
          title="Pedir alteração ou exclusão"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--neon-red)]/20 text-[10px] font-black text-[color:var(--neon-red)] ring-1 ring-[color:var(--neon-red)]/60 hover:bg-[color:var(--neon-red)]/40"
        >
          !
        </button>
      )}
      {disputePending && (
        <button
          disabled
          title="Pedido em andamento"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-400/20 text-[10px] font-black text-orange-400 ring-1 ring-orange-400/60"
        >
          ⏳
        </button>
      )}

      <p className="pr-7 text-base font-bold leading-snug">{bet.description}</p>

      <div className="flex items-center justify-center rounded-xl bg-green-400/10 px-3 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-green-400">ODD</p>
        <p className="ml-2 text-3xl font-black tabular-nums text-green-400">{bet.odd.toFixed(2)}x</p>
      </div>

      {/* Dispute rejected badge */}
      {disputeRejected && (
        <div className="rounded-xl border border-[color:var(--neon-red)]/30 bg-[color:var(--neon-red)]/10 px-3 py-2 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-[color:var(--neon-red)]">
            ✗ Pedido de alteração negado
          </p>
        </div>
      )}

      {/* Dispute pending voting banner */}
      {disputePending && (
        <div className="rounded-xl border border-orange-400/40 bg-orange-400/10 p-3">
          <p className="mb-2 text-center text-xs font-black uppercase tracking-wider text-orange-400">
            {bet.disputeType === "delete" ? "⚡ Pedido de EXCLUSÃO" : "⚡ Pedido de MUDANÇA DE ODD"}
            {bet.disputeType === "change_odd" && bet.disputeNewOdd && (
              <span className="ml-1">→ {bet.disputeNewOdd.toFixed(2)}x</span>
            )}
          </p>
          <p className="mb-2 text-center text-[10px] text-orange-400/80">
            Aprovações: {bet.disputeApprovals}/{bet.disputeNeeded}
          </p>
          {bet.disputeVotedByMe ? (
            <p className="text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
              {bet.disputeVotedByMe === "approve" ? "✓ Você aprovou" : "✗ Você rejeitou"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => { onVoteDispute(bet.id, "approve"); toast.success("Aprovado!"); }}
                className="h-9 bg-[color:var(--neon-green)] text-xs font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
              >
                👍 Aprovar
              </Button>
              <Button
                onClick={() => { onVoteDispute(bet.id, "reject"); toast.success("Rejeitado!"); }}
                className="h-9 bg-[color:var(--neon-red)] text-xs font-black text-white hover:bg-[color:var(--neon-red)]/90"
              >
                👎 Rejeitar
              </Button>
            </div>
          )}
        </div>
      )}

      {bet.placed ? (
        <div className="rounded-xl border border-green-400/40 bg-green-400/10 p-3 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-green-400">
            Apostou {bet.placed.amount} conto
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Retorno potencial:{" "}
            <span className="font-black text-green-400">
              {(bet.placed.amount * bet.odd).toFixed(2)} conto
            </span>
          </p>
        </div>
      ) : (
        <Button
          onClick={() => { setBetOpen(true); setAmt("5"); }}
          className="h-12 w-full bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
        >
          Apostar
        </Button>
      )}

      {/* Bet dialog */}
      <Dialog open={betOpen} onOpenChange={(o) => !o && setBetOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apostar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{bet.description}</p>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-green-400" />
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              value={amt}
              onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))}
              className="h-14 text-xl font-black tabular-nums text-green-400"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Retorno potencial:{" "}
            <span className="font-black text-green-400">
              {((Number(amt) || 0) * bet.odd).toFixed(2)} conto
            </span>
          </p>
          <DialogFooter>
            <Button
              className="h-12 w-full font-bold"
              onClick={() => {
                const n = Number(amt);
                if (!n || n < 1) { toast.error("Valor inválido"); return; }
                if (!spend(n)) { toast.error("Sem conto suficiente"); return; }
                placeBet(bet.id, n);
                toast.success(`Aposta de ${n} conto confirmada`);
                setBetOpen(false);
              }}
            >
              Confirmar Aposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute request dialog */}
      <DisputeRequestDialog
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        currentOdd={bet.odd}
        onConfirm={(type, newOdd) => {
          onRequestDispute(bet.id, type, newOdd);
          toast.success("Pedido enviado para votação!");
        }}
      />
    </div>
  );
}

function VoteCard({ bet }: { bet: Bet }) {
  const { voteBet } = useApp();
  const voted = !!bet.voted;
  const resolved = !!bet.resolved;

  return (
    <div className={"rounded-2xl border border-border/60 bg-card p-4 transition " + (resolved ? "opacity-60" : "")}>
      <p className="text-base font-bold leading-snug">{bet.description}</p>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-xs font-bold text-green-400">ODD {bet.odd.toFixed(2)}x</span>
      </div>

      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span className="font-bold text-green-400">✓ Aconteceu: {bet.votesHappened}/2</span>
        <span className="font-bold text-[color:var(--neon-red)]">✗ Não rolou: {bet.votesNot}/2</span>
      </div>

      {resolved ? (
        <div className="mt-3 rounded-xl border border-green-400/40 bg-green-400/10 p-3 text-center">
          <p className="font-black uppercase tracking-wide text-green-400">
            Resultado: {bet.resolved === "happened" ? "✓ ACONTECEU" : "✗ NÃO ROLOU"}
          </p>
        </div>
      ) : voted ? (
        <p className="mt-3 text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
          Seu voto foi registrado — aguardando mais votos
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            className="h-12 bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
            onClick={() => {
              const result = voteBet(bet.id, "happened");
              if (result.resolved && result.won && result.winnings > 0) {
                toast.success(`PORRAAAA VOCÊ GANHOU ${result.winnings} CONTO COM ${result.description}`, { duration: 6000 });
              } else if (result.resolved) {
                toast.error("Resultado registrado: você não ganhou dessa vez 😅");
              } else {
                toast.success("Voto registrado: aconteceu ✓");
              }
            }}
          >
            ACONTECEU
          </Button>
          <Button
            className="h-12 bg-[color:var(--neon-red)] font-black text-white hover:bg-[color:var(--neon-red)]/90"
            onClick={() => {
              const result = voteBet(bet.id, "not");
              if (result.resolved) {
                toast.error("Resultado registrado: não rolou ✗");
              } else {
                toast.success("Voto registrado: não rolou ✗");
              }
            }}
          >
            NÃO ACONTECEU
          </Button>
        </div>
      )}
    </div>
  );
}

function DisputeRequestDialog({
  open,
  onOpenChange,
  currentOdd,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentOdd: number;
  onConfirm: (type: "change_odd" | "delete", newOdd?: number) => void;
}) {
  const [type, setType] = useState<"change_odd" | "delete">("change_odd");
  const [newOdd, setNewOdd] = useState(currentOdd);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contestar aposta</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Pede para o grupo votar. Se aprovado, a aposta é alterada ou excluída.
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("change_odd")}
              className={`rounded-xl border p-3 text-left text-sm font-bold transition ${type === "change_odd" ? "border-[color:var(--neon-purple)] bg-[color:var(--neon-purple)]/20 text-[color:var(--neon-purple)]" : "border-border/60 text-muted-foreground hover:bg-card"}`}
            >
              📊 Mudar a ODD
            </button>
            <button
              onClick={() => setType("delete")}
              className={`rounded-xl border p-3 text-left text-sm font-bold transition ${type === "delete" ? "border-[color:var(--neon-red)] bg-[color:var(--neon-red)]/20 text-[color:var(--neon-red)]" : "border-border/60 text-muted-foreground hover:bg-card"}`}
            >
              🗑️ Excluir aposta
            </button>
          </div>
          {type === "change_odd" && (
            <OddsInput
              value={newOdd}
              onChange={setNewOdd}
              label="Nova ODD"
              colorClass="text-[color:var(--neon-purple)]"
            />
          )}
          {type === "delete" && (
            <div className="rounded-xl border border-[color:var(--neon-red)]/40 bg-[color:var(--neon-red)]/10 p-3 text-center">
              <p className="text-xs font-bold text-[color:var(--neon-red)]">
                Se aprovado, quem apostou recebe o dinheiro de volta.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (type === "change_odd" && newOdd < 1.01) { toast.error("ODD precisa ser > 1.01"); return; }
              onConfirm(type, type === "change_odd" ? newOdd : undefined);
              onOpenChange(false);
            }}
          >
            Enviar para votação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestDialog({
  open,
  onOpenChange,
  onSuggest,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuggest: (desc: string, odd: number) => void;
}) {
  const [desc, setDesc] = useState("");
  const [odd, setOdd] = useState(1.8);

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
          <OddsInput
            value={odd}
            onChange={setOdd}
            label="ODD"
            colorClass="text-green-400"
          />
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (!desc.trim()) { toast.error("Descreve a merda aí"); return; }
              if (odd < 1.01) { toast.error("ODD precisa ser > 1.01"); return; }
              onSuggest(desc.trim(), odd);
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
