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

type Ctx = {
  user: User;
  balance: number;
  login: (name: string) => void;
  logout: () => void;
  addBalance: (n: number) => void;
  spend: (n: number) => boolean;

  groups: Group[];
  joinedGroupIds: string[];
  createGroup: (name: string, password: string) => Group;
  joinGroup: (id: string) => void;

  parties: Party[];
  addParty: (groupId: string, name: string, start: string, end: string) => void;
  confirmAttendance: (partyId: string) => void;

  pending: PendingBet[];
  approvePending: (id: string) => void;
  suggestBet: (partyId: string, description: string, oddFor: number, oddAgainst: number) => void;

  bets: Bet[];
  placeBet: (betId: string, side: "for" | "against", amount: number) => void;
  cashOut: (betId: string) => number;
  voteBet: (betId: string, vote: "happened" | "not") => void;

  esmolas: Esmola[];
  requestEsmola: (groupId: string, amount: number) => void;
  donateEsmola: (id: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [balance, setBalance] = useState(0);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [joinedGroupIds, setJoined] = useState<string[]>(["g1", "g2"]);
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [pending, setPending] = useState<PendingBet[]>(initialPending);
  const [bets, setBets] = useState<Bet[]>(initialBets);
  const [esmolas, setEsmolas] = useState<Esmola[]>(initialEsmolas);

  const login = useCallback((name: string) => {
    setUser({ name });
    setBalance(50);
  }, []);

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

  const createGroup = useCallback((name: string, password: string) => {
    const g: Group = {
      id: `g${Date.now()}`,
      name,
      members: 1,
      password,
    };
    setGroups((gs) => [g, ...gs]);
    setJoined((j) => [g.id, ...j]);
    return g;
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
      };
      setParties((ps) => [p, ...ps]);
    },
    [],
  );

  const confirmAttendance = useCallback((partyId: string) => {
    setParties((ps) =>
      ps.map((p) => (p.id === partyId ? { ...p, attending: true } : p)),
    );
    setBalance((b) => b + 50);
  }, []);

  const approvePending = useCallback((id: string) => {
    setPending((ps) =>
      ps.map((p) =>
        p.id === id && !p.approvedByMe
          ? { ...p, approvals: p.approvals + 1, approvedByMe: true }
          : p,
      ),
    );
  }, []);

  const suggestBet = useCallback(
    (partyId: string, description: string, oddFor: number, oddAgainst: number) => {
      const pb: PendingBet = {
        id: `pb${Date.now()}`,
        partyId,
        description,
        approvals: 0,
        needed: 3,
      };
      setPending((ps) => [pb, ...ps]);
      // also stage a bet (would be activated after validation) — for mock,
      // we also add to live with the user's chosen odds:
      setBets((bs) => [
        {
          id: `b${Date.now()}`,
          partyId,
          description,
          oddFor,
          oddAgainst,
        },
        ...bs,
      ]);
    },
    [],
  );

  const placeBet = useCallback(
    (betId: string, side: "for" | "against", amount: number) => {
      setBets((bs) =>
        bs.map((b) => (b.id === betId ? { ...b, placed: { side, amount } } : b)),
      );
    },
    [],
  );

  const cashOut = useCallback(
    (betId: string) => {
      const bet = bets.find((b) => b.id === betId);
      if (!bet?.placed) return 0;
      const odd = bet.placed.side === "for" ? bet.oddFor : bet.oddAgainst;
      // cash out is a fraction (mock): 0.7x of potential
      const value = Math.max(1, Math.round(bet.placed.amount * odd * 0.7));
      setBalance((b) => b + value);
      setBets((bs) => bs.map((b) => (b.id === betId ? { ...b, placed: undefined } : b)));
      return value;
    },
    [bets],
  );

  const voteBet = useCallback((betId: string, vote: "happened" | "not") => {
    setBets((bs) => bs.map((b) => (b.id === betId ? { ...b, voted: vote } : b)));
  }, []);

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
    setEsmolas((es) => es.map((e) => (e.id === id ? { ...e, donated: true } : e)));
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
      parties,
      addParty,
      confirmAttendance,
      pending,
      approvePending,
      suggestBet,
      bets,
      placeBet,
      cashOut,
      voteBet,
      esmolas,
      requestEsmola,
      donateEsmola,
    }),
    [
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
      parties,
      addParty,
      confirmAttendance,
      pending,
      approvePending,
      suggestBet,
      bets,
      placeBet,
      cashOut,
      voteBet,
      esmolas,
      requestEsmola,
      donateEsmola,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
