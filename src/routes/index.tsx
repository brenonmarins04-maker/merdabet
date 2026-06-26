import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, PartyPopper, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp, type PlayerStats } from "@/lib/app-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MerdaBet — Grupos" },
      { name: "description", content: "Seus grupos e festas no MerdaBet." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, groups, joinedGroupIds, createGroup, joinGroup, deleteGroup, updateGroup, logout, playerStats } = useApp();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [joinDialogId, setJoinDialogId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <AppHeader />
      <main className="mx-auto max-w-md space-y-6 px-4 pt-5">
        {/* Hero */}
        <section className="bg-party-gradient relative overflow-hidden rounded-2xl p-5 shadow-xl">
          <div className="absolute -right-6 -top-6 opacity-30">
            <PartyPopper className="h-28 w-28" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">
            Pense · Faça a ODD · Aposte
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-white">
            Aposte nas merdas que vão acontecer nas festas 🍻
          </h2>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/30 px-4 py-3">
            <span className="text-2xl">🤮</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                Luizinho tomar 5 beats e gorfar
              </p>
              <p className="text-xs font-black text-green-400">ODD 1.2</p>
            </div>
          </div>
        </section>

        {/* Rankings */}
        <RankingSection playerStats={playerStats} />

        {/* Actions */}
        <section className="grid grid-cols-2 gap-3">
          <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                className="h-14 gap-2 text-sm font-bold uppercase tracking-wide"
              >
                <Search className="h-4 w-4" />
                Buscar Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buscar grupo</DialogTitle>
              </DialogHeader>
              <Input placeholder="Nome do grupo..." className="h-12" />
              <p className="text-xs text-muted-foreground">
                (Mock) usa a lista abaixo, mlk.
              </p>
            </DialogContent>
          </Dialog>
        </section>

        {/* Groups */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Seus grupos
            </h3>
            <span className="text-xs text-muted-foreground">{groups.length} no rolê</span>
          </div>
          <ul className="space-y-3">
            {groups.map((g) => {
              const joined = joinedGroupIds.includes(g.id);
              const isOwner = g.createdBy === user.name;
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold">{g.name}</p>
                      {isOwner && (
                        <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                          dono
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {g.members} membros
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isOwner && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
                          onClick={() => setEditGroupId(g.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => setDeleteConfirmId(g.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {joined ? (
                      <Button asChild size="sm" className="h-10 px-4 font-bold">
                        <Link to="/group/$groupId" params={{ groupId: g.id }}>
                          Abrir
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-10 px-4 font-bold"
                        onClick={() => setJoinDialogId(g.id)}
                      >
                        Entrar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
            {groups.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Nenhum grupo ainda. Cria um ou entra em um!
              </li>
            )}
          </ul>
        </section>

        <button
          onClick={() => { logout(); navigate({ to: "/auth" }); }}
          className="mx-auto mt-6 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3 w-3" /> sair
        </button>
      </main>

      <JoinDialog
        groupId={joinDialogId}
        onClose={() => setJoinDialogId(null)}
        onJoined={(id) => {
          joinGroup(id);
          setJoinDialogId(null);
          toast.success("Entrou no grupo!");
          navigate({ to: "/group/$groupId", params: { groupId: id } });
        }}
      />

      <EditGroupDialog
        group={groups.find((g) => g.id === editGroupId) ?? null}
        onClose={() => setEditGroupId(null)}
        onSave={(id, name, password) => {
          updateGroup(id, name, password);
          setEditGroupId(null);
          toast.success("Grupo atualizado!");
        }}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar grupo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso vai apagar o grupo e todas as festas dele permanentemente. Não tem volta.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-red-500 font-bold text-white hover:bg-red-600"
              onClick={() => {
                if (!deleteConfirmId) return;
                deleteGroup(deleteConfirmId);
                setDeleteConfirmId(null);
                toast.success("Grupo apagado.");
              }}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createGroup } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="glow-purple h-14 gap-2 bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Criar Grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Nome do grupo"
            className="h-12"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Senha do grupo"
            type="password"
            className="h-12"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (!name.trim() || !pass.trim()) {
                toast.error("Faltou nome ou senha");
                return;
              }
              const g = createGroup(name.trim(), pass.trim());
              onOpenChange(false);
              setName("");
              setPass("");
              toast.success("Grupo criado!");
              navigate({ to: "/group/$groupId", params: { groupId: g.id } });
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function RankingSection({ playerStats }: { playerStats: Record<string, PlayerStats> }) {
  const entries = Object.entries(playerStats);

  const topLocos = [...entries]
    .sort((a, b) => b[1].betCount - a[1].betCount)
    .slice(0, 3);

  const topRicos = [...entries]
    .sort((a, b) => b[1].balance - a[1].balance)
    .slice(0, 3);

  if (entries.length === 0) return null;

  return (
    <section className="grid grid-cols-2 gap-3">
      {/* Os + Loucos */}
      <div className="rounded-2xl border border-border/60 bg-card p-3">
        <p className="mb-2 text-center text-[11px] font-black uppercase tracking-widest text-[color:var(--neon-purple)]">
          🤪 Os + Loucos
        </p>
        {topLocos.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">Ninguém apostou ainda</p>
        ) : (
          <ol className="space-y-1.5">
            {topLocos.map(([name, stats], i) => (
              <li key={name} className="flex items-center gap-2">
                <span className="text-lg">{MEDALS[i]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black">{name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.betCount} aposta{stats.betCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Os + Ricos */}
      <div className="rounded-2xl border border-border/60 bg-card p-3">
        <p className="mb-2 text-center text-[11px] font-black uppercase tracking-widest text-green-400">
          💰 Os + Ricos
        </p>
        {topRicos.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">Ninguém tem grana ainda</p>
        ) : (
          <ol className="space-y-1.5">
            {topRicos.map(([name, stats], i) => (
              <li key={name} className="flex items-center gap-2">
                <span className="text-lg">{MEDALS[i]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black">{name}</p>
                  <p className="text-[10px] font-bold tabular-nums text-green-400">
                    {stats.balance} conto
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function EditGroupDialog({
  group,
  onClose,
  onSave,
}: {
  group: { id: string; name: string; password: string } | null;
  onClose: () => void;
  onSave: (id: string, name: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");

  useEffect(() => {
    if (group) { setName(group.name); setPass(group.password); }
  }, [group?.id]);

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Nome do grupo"
            className="h-12"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Senha do grupo"
            type="password"
            className="h-12"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (!group) return;
              if (!name.trim() || !pass.trim()) { toast.error("Faltou nome ou senha"); return; }
              onSave(group.id, name.trim(), pass.trim());
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JoinDialog({
  groupId,
  onClose,
  onJoined,
}: {
  groupId: string | null;
  onClose: () => void;
  onJoined: (id: string) => void;
}) {
  const { groups } = useApp();
  const [pass, setPass] = useState("");
  const g = groups.find((x) => x.id === groupId);

  return (
    <Dialog open={!!groupId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar em {g?.name}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Senha do grupo"
          type="password"
          className="h-12"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <DialogFooter>
          <Button
            className="h-12 w-full font-bold"
            onClick={() => {
              if (!g) return;
              if (pass !== g.password) { toast.error("Senha errada"); return; }
              setPass("");
              onJoined(g.id);
            }}
          >
            Entrar no grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
