import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins } from "lucide-react";
import { useApp } from "@/lib/app-context";

type Props = {
  back?: string;
  title?: string;
};

export function AppHeader({ back, title }: Props) {
  const { user, balance } = useApp();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {back && (
            <Link
              to={back}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground hover:bg-accent"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0">
            {title ? (
              <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  E aí
                </p>
                <p className="truncate text-sm font-bold">{user?.name ?? "convidado"}</p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-400/40 bg-green-400/10 px-3 py-1.5 text-sm font-black text-green-400">
          <Coins className="h-4 w-4" />
          <span className="tabular-nums">{balance}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
            conto
          </span>
        </div>
      </div>
    </header>
  );
}
