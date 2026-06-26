import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import type { Party } from "@/lib/mock-data";

export const Route = createFileRoute("/group/$groupId")({
  head: () => ({ meta: [{ title: "MerdaBet — Grupo" }] }),
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const { groups, parties, esmolas, requestEsmola, donateEsmola, addParty, addBalance, spend } =
    useApp();
  const navigate = useNavigate();
  const group = groups.find((g) => g.id === groupId);
  const [askAmt, setAskAmt] = useState(10);
  const [fabOpen, setFabOpen] = useState(false);

  if (!group) {
    return (
      <div className="min-h-dvh">
        <AppHeader back="/" title="Grupo não encontrado" />
      </div>
    );
  }

  const groupParties = parties.filter((p) => p.groupId === groupId);
  const groupEsmolas = esmolas.filter((e) => e.groupId === groupId);

  return (
    <div className="min-h-dvh pb-32">
      <AppHeader back="/" title={group.name} />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{group.members} membros</span>
        </div>

        {/* Esmola card */}
        <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-widest text-neon-purple">
                <HandHeart className="h-4 w-4" />
                Esmolinha
              </h3>
              <p className="text-xs text-muted-foreground">Tá liso? Pede aí.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={askAmt}
              onChange={(e) => setAskAmt(Math.max(1, Number(e.target.value) || 1))}
              className="h-12 text-base font-bold tabular-nums"
            />
            <Button
              className="glow-purple h-12 shrink-0 bg-primary font-bold text-primary-foreground"
              onClick={() => {
                requestEsmola(groupId, askAmt);
                toast.success(`Pediu ${askAmt} contos de esmola`);
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
                      <p className="flex items-center gap-1 text-[color:var(--coin)]">
                        <Coins className="h-3 w-3" />
                        <span className="font-black tabular-nums">{e.amount}</span> contos
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={e.donated}
                    onClick={() => {
                      if (!spend(e.amount)) {
                        toast.error("Sem contos suficientes");
                        return;
                      }
                      donateEsmola(e.id);
                      toast.success(`Você doou ${e.amount} contos`);
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

        {/* Parties */}
        <section className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            Festas
          </h3>
          <ul className="space-y-3">
            {groupParties.map((p) => (
              <PartyCard key={p.id} party={p} />
            ))}
            {groupParties.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Nenhuma festa por aqui. Adiciona uma no botão +.
              </li>
            )}
          </ul>
        </section>
      </main>

      {/* FAB */}
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

function statusBadge(s: Party["status"]) {
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

function PartyCard({ party }: { party: Party }) {
  const date = new Date(party.start);
  return (
    <li>
      <Link
        to="/party/$partyId"
        params={{ partyId: party.id }}
        className="block rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{party.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {date.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}{" "}
              ·{" "}
              {date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {statusBadge(party.status)}
        </div>
      </Link>
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
              onAdd(
                name,
                new Date(start).toISOString(),
                new Date(end).toISOString(),
              );
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
