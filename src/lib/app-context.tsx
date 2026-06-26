import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  initialBets,
  initialEsmolas,
  initialGroups,
  initialParties,
  initialPending,
  type Bet,
  type Esmola,
  type Group,
  type Party,
  type PendingBet,
} from "./mock-data";

type User = { name: string } | null;

export type PlayerStats = { balance: number; betCount: number };

export type VoteBetResult = {
  resolved: boolean;
  outcome?: "happened" | "not";
  won: boolean;
  winnings: number;
  description: string;
};

type Ctx = {
  user: User;
  balance: number;
  login: (name: string, password: string) => string | null;
  logout: () => void;
  addBalance: (n: number) => void;
  spend: (n: number) => boolean;

  groups: Group[];
  joinedGroupIds: string[];
  createGroup: (name: string, password: string) => Group;
  joinGroup: (id: string) => void;
  deleteGroup: (id: string) => void;

  parties: Party[];
  addParty: (groupId: string, name: string, start: string, end: string) => void;
  confirmAttendance: (partyId: string) => void;

  pending: PendingBet[];
  votePending: (id: string, vote: "approve" | "reject") => void;
  suggestBet: (partyId: string, description: string, oddFor: number, oddAgainst: number) => void;

  bets: Bet[];
  placeBet: (betId: string, side: "for" | "against", amount: number) => void;
  voteBet: (betId: string, vote: "happened" | "not") => VoteBetResult;

  playerStats: Record<string, PlayerStats>;

  esmolas: Esmola[];
  requestEsmola: (groupId: string, amount: number) => void;
  donateEsmola: (id: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [balance, setBalance] = useState(0);
  const [userRegistry, setUserRegistry] = useState<Record<string, string>>({});
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [joinedGroupIds, setJoined] = useState<string[]>([]);
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [pending, setPending] = useState<PendingBet[]>(initialPending);
  const [bets, setBets] = useState<Bet[]>(initialBets);
  const [esmolas, setEsmolas] = useState<Esmola[]>(initialEsmolas);

  const login = useCallback(
    (name: string, password: string): string | null => {
      if (name in userRegistry) {
        if (userRegistry[name] !== password) {
          return "Senha incorreta para este usuário.";
        }
        setUser({ name });
        setBalance(50);
        return null;
      }
      setUserRegistry((r) => ({ ...r, [name]: password }));
      setUser({ name });
      setBalance(50);
      setPlayerStats((s) => ({
        ...s,
        [name]: { balance: 50, betCount: s[name]?.betCount ?? 0 },
      }));
      return null;
    },
    [userRegistry],
  );

  const logout = useCallback(() => {
    setUser(null);
    setBalance(0);
  }, []);

  const addBalance = useCallback((n: number) => setBalance((b) => b + n), []);
  const spend = useCallback(
    (n: number) => {
      if (balance < n) return false;
      setBalance((b) => b - n);
      return true;
    },
    [balance],
  );

  const createGroup = useCallback(
    (name: string, password: string) => {
      const g: Group = {
        id: `g${Date.now()}`,
        name,
        members: 1,
        password,
        createdBy: user?.name ?? "",
      };
      setGroups((gs) => [g, ...gs]);
      setJoined((j) => [g.id, ...j]);
      return g;
    },
    [user],
  );

  const deleteGroup = useCallback((id: string) => {
    setGroups((gs) => gs.filter((g) => g.id !== id));
    setJoined((j) => j.filter((x) => x !== id));
    setParties((ps) => ps.filter((p) => p.groupId !== id));
  }, []);

  const joinGroup = useCallback((id: string) => {
    setJoined((j) => (j.includes(id) ? j : [...j, id]));
  }, []);

  const addParty = useCallback(
    (groupId: string, name: string, start: string, end: string) => {
      const p: Party = {
        id: `p${Date.now()}`,
        groupId,
        name,
        start,
        end,
        status: "pending",
        attendees: 0,
      };
      setParties((ps) => [p, ...ps]);
    },
    [],
  );

  const confirmAttendance = useCallback((partyId: string) => {
    setParties((ps) =>
      ps.map((p) =>
        p.id === partyId
          ? { ...p, attending: true, attendees: p.attendees + 1 }
          : p,
      ),
    );
    setBalance((b) => b + 10);
  }, []);

  const votePending = useCallback(
    (id: string, vote: "approve" | "reject") => {
      setPending((ps) => {
        const updated = ps.map((p) => {
          if (p.id !== id) return p;
          if (p.approvedByMe || p.rejectedByMe) return p;
          const newApprovals = vote === "approve" ? p.approvals + 1 : p.approvals;
          return {
            ...p,
            approvals: newApprovals,
            approvedByMe: vote === "approve" ? true : p.approvedByMe,
            rejectedByMe: vote === "reject" ? true : p.rejectedByMe,
          };
        });

        const promoted = updated.find((p) => p.id === id && p.approvals >= p.needed);
        if (promoted) {
          setBets((bs) => [
            {
              id: `b${Date.now()}`,
              partyId: promoted.partyId,
              description: promoted.description,
              oddFor: promoted.oddFor,
              oddAgainst: promoted.oddAgainst,
              votesHappened: 0,
              votesNot: 0,
            },
            ...bs,
          ]);
          return updated.filter((p) => p.id !== id);
        }
        return updated;
      });
    },
    [],
  );

  const suggestBet = useCallback(
    (partyId: string, description: string, oddFor: number, oddAgainst: number) => {
      const party = parties.find((p) => p.id === partyId);
      const attendees = party?.attendees ?? 0;
      const needed = Math.max(1, Math.ceil(attendees / 3));
      const pb: PendingBet = {
        id: `pb${Date.now()}`,
        partyId,
        description,
        oddFor,
        oddAgainst,
        approvals: 0,
        needed,
      };
      setPending((ps) => [pb, ...ps]);
    },
    [parties],
  );

  const placeBet = useCallback(
    (betId: string, side: "for" | "against", amount: number) => {
      setBets((bs) =>
        bs.map((b) => (b.id === betId ? { ...b, placed: { side, amount } } : b)),
      );
      if (user) {
        setPlayerStats((s) => ({
          ...s,
          [user.name]: {
            balance: s[user.name]?.balance ?? balance,
            betCount: (s[user.name]?.betCount ?? 0) + 1,
          },
        }));
      }
    },
    [user, balance],
  );

  const voteBet = useCallback(
    (betId: string, vote: "happened" | "not"): VoteBetResult => {
      const bet = bets.find((b) => b.id === betId);
      if (!bet || bet.voted) {
        return { resolved: false, won: false, winnings: 0, description: "" };
      }

      const newVotesHappened =
        vote === "happened" ? bet.votesHappened + 1 : bet.votesHappened;
      const newVotesNot =
        vote === "not" ? bet.votesNot + 1 : bet.votesNot;

      let outcome: "happened" | "not" | undefined;
      if (newVotesHappened >= 2) outcome = "happened";
      else if (newVotesNot >= 2) outcome = "not";

      let won = false;
      let winnings = 0;

      if (outcome && bet.placed) {
        won =
          (outcome === "happened" && bet.placed.side === "for") ||
          (outcome === "not" && bet.placed.side === "against");
        if (won) {
          winnings = Math.round(
            bet.placed.amount *
              (bet.placed.side === "for" ? bet.oddFor : bet.oddAgainst),
          );
          setBalance((b) => {
            const newBal = b + winnings;
            if (user) {
              setPlayerStats((s) => ({
                ...s,
                [user.name]: { ...s[user.name], balance: newBal },
              }));
            }
            return newBal;
          });
        }
      }

      setBets((bs) =>
        bs.map((b) =>
          b.id === betId
            ? {
                ...b,
                votesHappened: newVotesHappened,
                votesNot: newVotesNot,
                voted: vote,
                resolved: outcome,
              }
            : b,
        ),
      );

      return {
        resolved: !!outcome,
        outcome,
        won,
        winnings,
        description: bet.description,
      };
    },
    [bets],
  );

  const requestEsmola = useCallback(
    (groupId: string, amount: number) => {
      if (!user) return;
      setEsmolas((es) => [
        { id: `e${Date.now()}`, groupId, user: user.name, amount },
        ...es,
      ]);
    },
    [user],
  );

  const donateEsmola = useCallback((id: string) => {
    setEsmolas((es) =>
      es.map((e) => (e.id === id ? { ...e, donated: true } : e)),
    );
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      balance,
      login,
      logout,
      addBalance,
      spend,
      groups,
      joinedGroupIds,
      createGroup,
      joinGroup,
      deleteGroup,
      parties,
      addParty,
      confirmAttendance,
      pending,
      votePending,
      suggestBet,
      bets,
      placeBet,
      voteBet,
      esmolas,
      requestEsmola,
      donateEsmola,
      playerStats,
    }),
    [
      user, balance, login, logout, addBalance, spend,
      groups, joinedGroupIds, createGroup, joinGroup, deleteGroup,
      parties, addParty, confirmAttendance,
      pending, votePending, suggestBet,
      bets, placeBet, voteBet,
      esmolas, requestEsmola, donateEsmola,
      playerStats,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
