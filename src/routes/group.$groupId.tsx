import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, HandHeart, Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { isEnded, type Party } from "@/lib/mock-data";

export const Route = createFileRoute("/group/$groupId")({
  head: () => ({ meta: [{ title: "MerdaBet — Grupo" }] }),
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const { groups, parties, esmolas, requestEsmola, donateEsmola, addParty, spend, confirmAttendance } =
    useApp();
  const navigate = useNavigate();
  const group = groups.find((g) => g.id === groupId);
  const [askAmt, setAskAmt] = useState(10);
  const [fabOpen, setFabOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!group) {
    return (
      <div className="min-h-dvh">
        <AppHeader back="/" title="Grupo não encontrado" />
      </div>
    );
  }

  const groupParties = parties
    .filter((p) => p.groupId === groupId)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  const visibleParties = showAll ? groupParties : groupParties.slice(0, 3);
  const groupEsmolas = esmolas.filter((e) => e.groupId === groupId);

  return (
    <div className="min-h-dvh pb-32">
      <AppHeader back="/" title={group.name} />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{group.members} membros</span>
        </div>

        {/* Parties */}
        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            Festas
          </h3>
          <ul className="space-y-3">
            {visibleParties.map((p) => (
              <PartyCard
                key={p.id}
                party={p}
                onConfirmAttendance={() => {
                  confirmAttendance(p.id);
                  toast.success("Presença confirmada! +10 conto 🪙");
                }}
                onEnter={() =>
                  navigate({ to: "/party/$partyId", params: { partyId: p.id } })
                }
              />
            ))}
            {groupParties.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Nenhuma festa por aqui. Adiciona uma no botão +.
              </li>
            )}
          </ul>
          {groupParties.length > 3 && !showAll && (
            <Button
              variant="outline"
              className="h-11 w-full font-bold"
              onClick={() => setShowAll(true)}
            >
              Ver mais ({groupParties.length - 3} festas)
            </Button>
          )}
        </section>

        {/* Esmola card */}
        <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-widest text-neon-purple">
              <HandHeart className="h-4 w-4" />
              Esmolinha
            </h3>
            <p className="text-xs text-muted-foreground">Tá liso? Pede aí.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              value={askAmt}
              onChange={(e) => setAskAmt(Math.max(1, Number(e.target.value) || 1))}
              className="h-12 text-base font-bold tabular-nums"
            />
            <Button
              className="glow-purple h-12 shrink-0 bg-primary font-bold text-primary-foreground"
              onClick={() => {
                requestEsmola(groupId, askAmt);
                toast.success(`Pediu ${askAmt} conto de esmola`);
              }}
            >
              Pedir Esmola
            </Button>
          </div>

          {groupEsmolas.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-2">
              {groupEsmolas.map((e) => (
                <div
                  key={e.id}
                  className="flex min-w-[210px] flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-black text-primary-foreground">
                      {e.user.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-bold">{e.user}</p>
                      <p className="flex items-center gap-1 font-black tabular-nums text-green-400">
                        <Coins className="h-3 w-3" />
                        <span>{e.amount}</span> conto
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={e.donated}
                    onClick={() => {
                      if (!spend(e.amount)) {
                        toast.error("Sem conto suficiente");
                        return;
                      }
                      donateEsmola(e.id);
                      toast.success(`Você doou ${e.amount} conto`);
                    }}
                    className="h-9 font-bold"
                  >
                    {e.donated ? "Doado ✓" : "Doar"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <button
        onClick={() => setFabOpen(true)}
        className="glow-purple fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"
        aria-label="Adicionar festa"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddPartyDialog
        open={fabOpen}
        onOpenChange={setFabOpen}
        onAdd={(name, start, end) => {
          addParty(groupId, name, start, end);
          toast.success("Festa adicionada");
        }}
      />
    </div>
  );
}

function statusBadge(s: Party["status"], ended: boolean) {
  if (ended) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        Encerrada
      </span>
    );
  }
  switch (s) {
    case "pending":
      return (
        <span className="rounded-full bg-[color:var(--neon-yellow)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--neon-yellow)]">
          Pendente
        </span>
      );
    case "live":
      return (
        <span className="glow-green rounded-full bg-[color:var(--neon-green)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--neon-green)]">
          ● Acontecendo
        </span>
      );
    case "ended":
      return (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Encerrada
        </span>
      );
  }
}

function PartyCard({
  party,
  onConfirmAttendance,
  onEnter,
}: {
  party: Party;
  onConfirmAttendance: () => void;
  onEnter: () => void;
}) {
  const date = new Date(party.start);
  const beforeStart = Date.now() < date.getTime();
  const ended = isEnded(party);
  const needsAttendance = beforeStart && !party.attending && !ended;

  return (
    <li className="overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:border-primary/60">
      {ended && (
        <div className="flex items-center justify-center gap-2 bg-[color:var(--neon-yellow)]/15 px-4 py-2 text-center">
          <span className="text-xl">🗳️</span>
          <p className="text-xs font-black uppercase tracking-wider text-[color:var(--neon-yellow)]">
            Festa encerrada — Vote nas apostas!
          </p>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{party.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}{" "}
              ·{" "}
              {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {statusBadge(party.status, ended)}
        </div>

        <div className="mt-3 flex gap-2">
          {needsAttendance && (
            <Button
              size="sm"
              className="h-10 flex-1 animate-pulse bg-[color:var(--neon-green)] font-black text-zinc-950 hover:bg-[color:var(--neon-green)]/90"
              onClick={(e) => { e.stopPropagation(); onConfirmAttendance(); }}
            >
              🎉 Vou na festa!
            </Button>
          )}
          {party.attending && (
            <span className="flex h-10 flex-1 items-center justify-center rounded-lg border border-green-400/40 bg-green-400/10 text-xs font-black uppercase tracking-wider text-green-400">
              ✓ Confirmado
            </span>
          )}
          <Button
            size="sm"
            className="h-12 flex-[2] bg-primary font-black text-primary-foreground hover:bg-primary/90"
            onClick={onEnter}
          >
            Entrar na festa →
          </Button>
        </div>
      </div>
    </li>
  );
}

function AddPartyDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (name: string, start: string, end: string) => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova festa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Nome da festa"
            className="h-12"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Início
              </label>
              <Input
                type="datetime-local"
                className="h-12"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Término
              </label>
              <Input
                type="datetime-local"
                className="h-12"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (!name || !start || !end) {
                toast.error("Preenche tudo");
                return;
              }
              onAdd(name, new Date(start).toISOString(), new Date(end).toISOString());
              setName("");
              setStart("");
              setEnd("");
              onOpenChange(false);
            }}
          >
            Adicionar Festa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
