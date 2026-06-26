import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import {
  type Bet,
  type Esmola,
  type Group,
  type Party,
  type PendingBet,
} from "./mock-data";

type User = { name: string } | null;

export type PlayerStats = { balance: number; betCount: number };

export type GroupMemberInsight = {
  userId: string;
  balance: number;
  betCount: number;
  activeBets: number;
  activeStake: number;
  potentialReturn: number;
};

export type VoteBetResult = {
  resolved: boolean;
  outcome?: "happened" | "not";
  won: boolean;
  winnings: number;
  description: string;
};

// ─── Session (localStorage: only username + expiry) ───────────────────────────

const SESSION_KEY = "merdabet_session_v2";
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

type SessionData = { username: string; expiry: number };

function loadSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: SessionData = JSON.parse(raw);
    if (Date.now() > s.expiry) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveSession(username: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ username, expiry: Date.now() + SESSION_TTL }),
    );
  }
}

function clearSession() {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
}

// ─── DB row types ──────────────────────────────────────────────────────────────

type DbUser = { id: string; balance: number; bet_count: number };
type DbGroup = { id: string; name: string; password: string; created_by: string; members: number };
type DbParty = {
  id: string; group_id: string; name: string;
  start_time: string; end_time: string; status: string; attendees: number;
};
type DbPendingBet = {
  id: string; party_id: string; description: string;
  odd: number; approvals: number; rejections: number; needed: number;
};
type DbBet = {
  id: string; party_id: string; description: string;
  odd: number; votes_happened: number; votes_not: number; resolved: string | null;
  initial_odd?: number | null; current_odd?: number | null;
  validated_at?: string | null; odd_time_block?: number | null;
  placements_count: number; total_wagered: number;
  dispute_type: string | null; dispute_new_odd: number | null;
  dispute_approvals: number; dispute_rejections: number;
  dispute_needed: number; dispute_status: string;
};
type DbEsmola = { id: string; group_id: string; user_id: string; amount: number; donated: boolean };
type PlacedBet = { amount: number; odd: number };
type DbGroupMember = { group_id: string; user_id: string };
type DbBetPlacement = { bet_id: string; user_id: string; amount: number; locked_odd?: number | null };
type BetPlacement = { betId: string; userId: string; amount: number; odd: number };

// ─── Mapping helpers ───────────────────────────────────────────────────────────

function mapGroup(r: DbGroup): Group {
  return { id: r.id, name: r.name, password: r.password, createdBy: r.created_by, members: r.members };
}

function mapParty(r: DbParty, attendedIds: Set<string>): Party {
  return {
    id: r.id, groupId: r.group_id, name: r.name,
    start: r.start_time, end: r.end_time,
    status: r.status as Party["status"],
    attendees: r.attendees,
    attending: attendedIds.has(r.id),
  };
}

function mapPendingBet(
  r: DbPendingBet,
  approvedIds: Set<string>,
  rejectedIds: Set<string>,
): PendingBet {
  return {
    id: r.id, partyId: r.party_id, description: r.description,
    odd: Number(r.odd), approvals: r.approvals, rejections: r.rejections ?? 0, needed: r.needed,
    approvedByMe: approvedIds.has(r.id),
    rejectedByMe: rejectedIds.has(r.id),
  };
}

function mapBet(
  r: DbBet,
  placedMap: Map<string, PlacedBet>,
  votedMap: Map<string, "happened" | "not" | "unsure">,
  disputeVotedMap: Map<string, "approve" | "reject">,
  topPlacerMap: Map<string, { userId: string; amount: number }>,
): Bet {
  const placed = placedMap.get(r.id);
  const voted = votedMap.get(r.id);
  return {
    id: r.id, partyId: r.party_id, description: r.description,
    odd: Number(r.current_odd ?? r.odd),
    initialOdd: Number(r.initial_odd ?? r.odd),
    votesHappened: r.votes_happened, votesNot: r.votes_not,
    resolved: r.resolved as Bet["resolved"],
    placementsCount: r.placements_count ?? 0,
    totalWagered: r.total_wagered ?? 0,
    topPlacer: topPlacerMap.get(r.id),
    placed,
    voted,
    disputeType: r.dispute_type as Bet["disputeType"],
    disputeNewOdd: r.dispute_new_odd ?? undefined,
    disputeApprovals: r.dispute_approvals ?? 0,
    disputeRejections: r.dispute_rejections ?? 0,
    disputeNeeded: r.dispute_needed ?? 1,
    disputeStatus: (r.dispute_status ?? "none") as Bet["disputeStatus"],
    disputeVotedByMe: disputeVotedMap.get(r.id),
  };
}

function mapEsmola(r: DbEsmola): Esmola {
  return { id: r.id, groupId: r.group_id, user: r.user_id, amount: r.amount, donated: r.donated };
}

function mapBetPlacement(r: DbBetPlacement): BetPlacement {
  return {
    betId: r.bet_id,
    userId: r.user_id,
    amount: r.amount,
    odd: Number(r.locked_odd ?? 1.01),
  };
}

function groupMembersByGroup(rows: DbGroupMember[]): Record<string, string[]> {
  const byGroup: Record<string, Set<string>> = {};
  for (const row of rows) {
    byGroup[row.group_id] ??= new Set<string>();
    byGroup[row.group_id].add(row.user_id);
  }

  return Object.fromEntries(
    Object.entries(byGroup).map(([groupId, members]) => [
      groupId,
      [...members].sort((a, b) => a.localeCompare(b)),
    ]),
  );
}

// ─── Context types ─────────────────────────────────────────────────────────────

type Ctx = {
  user: User;
  authReady: boolean;
  balance: number;
  login: (name: string, password: string) => Promise<string | null>;
  logout: () => void;
  addBalance: (n: number) => void;
  spend: (n: number) => boolean;

  groups: Group[];
  joinedGroupIds: string[];
  createGroup: (name: string, password: string) => Group;
  joinGroup: (id: string) => void;
  deleteGroup: (id: string) => void;
  updateGroup: (id: string, name: string, password: string) => void;

  parties: Party[];
  addParty: (groupId: string, name: string, start: string, end: string) => void;
  confirmAttendance: (partyId: string) => void;

  pending: PendingBet[];
  votePending: (id: string, vote: "approve" | "reject") => void;
  suggestBet: (partyId: string, description: string, odd: number) => void;

  bets: Bet[];
  placeBet: (betId: string, amount: number) => void;
  voteBet: (betId: string, vote: "happened" | "not" | "unsure") => VoteBetResult;
  requestDispute: (betId: string, type: "change_odd" | "delete", newOdd?: number) => void;
  voteDispute: (betId: string, vote: "approve" | "reject") => void;

  playerStats: Record<string, PlayerStats>;
  getGroupMemberInsights: (groupId: string) => GroupMemberInsight[];

  esmolas: Esmola[];
  requestEsmola: (groupId: string, amount: number) => void;
  donateEsmola: (id: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [authReady, setAuthReady] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoined] = useState<string[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [pending, setPending] = useState<PendingBet[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [esmolas, setEsmolas] = useState<Esmola[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [allPlacements, setAllPlacements] = useState<BetPlacement[]>([]);

  // Per-user junction data (stable refs, updated on load/subscription)
  const attendedIdsRef = useRef<Set<string>>(new Set());
  const approvedPendingIdsRef = useRef<Set<string>>(new Set());
  const rejectedPendingIdsRef = useRef<Set<string>>(new Set());
  const placedMapRef = useRef<Map<string, PlacedBet>>(new Map());
  const votedMapRef = useRef<Map<string, "happened" | "not" | "unsure">>(new Map());
  const disputeVotedMapRef = useRef<Map<string, "approve" | "reject">>(new Map());
  const topPlacerMapRef = useRef<Map<string, { userId: string; amount: number }>>(new Map());

  // ─── Data loading ────────────────────────────────────────────────────────────

  const loadUserData = useCallback(async (username: string) => {
    const [
      groupsRes,
      joinedRes,
      partiesRes,
      attendedRes,
      pendingRes,
      pendingVotesRes,
      betsRes,
      placementsRes,
      betVotesRes,
      disputeVotesRes,
      esmolasRes,
      usersRes,
      groupMembersRes,
      allPlacementsRes,
    ] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id").eq("user_id", username),
      supabase.from("parties").select("*").order("created_at", { ascending: false }),
      supabase.from("party_attendees").select("party_id").eq("user_id", username),
      supabase.from("pending_bets").select("*").order("created_at", { ascending: false }),
      supabase.from("pending_bet_votes").select("pending_bet_id, vote").eq("user_id", username),
      supabase.from("bets").select("*").order("created_at", { ascending: false }),
      supabase.from("bet_placements").select("bet_id, amount, locked_odd").eq("user_id", username),
      supabase.from("bet_votes").select("bet_id, vote").eq("user_id", username),
      supabase.from("bet_dispute_votes").select("bet_id, vote").eq("user_id", username),
      supabase.from("esmolas").select("*").order("created_at", { ascending: false }),
      supabase.from("users").select("id, balance, bet_count"),
      supabase.from("group_members").select("group_id, user_id"),
      supabase.from("bet_placements").select("bet_id, user_id, amount, locked_odd"),
    ]);

    // Build per-user sets/maps
    const attendedIds = new Set<string>((attendedRes.data ?? []).map((r: { party_id: string }) => r.party_id));
    const approvedIds = new Set<string>(
      (pendingVotesRes.data ?? [])
        .filter((r: { pending_bet_id: string; vote: string }) => r.vote === "approve")
        .map((r: { pending_bet_id: string }) => r.pending_bet_id),
    );
    const rejectedIds = new Set<string>(
      (pendingVotesRes.data ?? [])
        .filter((r: { pending_bet_id: string; vote: string }) => r.vote === "reject")
        .map((r: { pending_bet_id: string }) => r.pending_bet_id),
    );
    const placedMap = new Map<string, PlacedBet>(
      (placementsRes.data ?? []).map((r: { bet_id: string; amount: number; locked_odd?: number | null }) => [
        r.bet_id,
        { amount: r.amount, odd: Number(r.locked_odd ?? 1.01) },
      ] as [string, PlacedBet]),
    );
    const votedMap = new Map<string, "happened" | "not" | "unsure">(
      (betVotesRes.data ?? []).map((r: { bet_id: string; vote: string }) => [r.bet_id, r.vote as "happened" | "not" | "unsure"] as [string, "happened" | "not" | "unsure"]),
    );
    const disputeVotedMap = new Map<string, "approve" | "reject">(
      (disputeVotesRes.data ?? []).map((r: { bet_id: string; vote: string }) => [r.bet_id, r.vote as "approve" | "reject"] as [string, "approve" | "reject"]),
    );

    const topPlacerMap = new Map<string, { userId: string; amount: number }>();
    for (const p of (allPlacementsRes.data ?? []) as DbBetPlacement[]) {
      const cur = topPlacerMap.get(p.bet_id);
      if (!cur || p.amount > cur.amount) topPlacerMap.set(p.bet_id, { userId: p.user_id, amount: p.amount });
    }

    attendedIdsRef.current = attendedIds;
    approvedPendingIdsRef.current = approvedIds;
    rejectedPendingIdsRef.current = rejectedIds;
    placedMapRef.current = placedMap;
    votedMapRef.current = votedMap;
    disputeVotedMapRef.current = disputeVotedMap;
    topPlacerMapRef.current = topPlacerMap;

    setGroups((groupsRes.data ?? []).map(mapGroup));
    setJoined((joinedRes.data ?? []).map((r: { group_id: string }) => r.group_id));
    setParties((partiesRes.data ?? []).map((r: DbParty) => mapParty(r, attendedIds)));
    setPending((pendingRes.data ?? []).map((r: DbPendingBet) => mapPendingBet(r, approvedIds, rejectedIds)));
    setBets((betsRes.data ?? []).map((r: DbBet) => mapBet(r, placedMap, votedMap, disputeVotedMap, topPlacerMap)));
    setEsmolas((esmolasRes.data ?? []).map(mapEsmola));
    setGroupMembers(groupMembersByGroup((groupMembersRes.data ?? []) as DbGroupMember[]));
    setAllPlacements(((allPlacementsRes.data ?? []) as DbBetPlacement[]).map(mapBetPlacement));

    const stats: Record<string, PlayerStats> = {};
    for (const u of (usersRes.data ?? []) as DbUser[]) {
      stats[u.id] = { balance: u.balance, betCount: u.bet_count };
    }
    setPlayerStats(stats);

    // Set current user balance from DB
    const me = (usersRes.data ?? []).find((u: DbUser) => u.id === username) as DbUser | undefined;
    if (me) setBalance(me.balance);
  }, []);

  const refreshParties = useCallback(async (username: string) => {
    const [partiesRes, attendedRes] = await Promise.all([
      supabase.from("parties").select("*").order("created_at", { ascending: false }),
      supabase.from("party_attendees").select("party_id").eq("user_id", username),
    ]);
    const attendedIds = new Set<string>((attendedRes.data ?? []).map((r: { party_id: string }) => r.party_id));
    attendedIdsRef.current = attendedIds;
    setParties((partiesRes.data ?? []).map((r: DbParty) => mapParty(r, attendedIds)));
  }, []);

  const refreshPending = useCallback(async (username: string) => {
    const [pendingRes, pendingVotesRes] = await Promise.all([
      supabase.from("pending_bets").select("*").order("created_at", { ascending: false }),
      supabase.from("pending_bet_votes").select("pending_bet_id, vote").eq("user_id", username),
    ]);
    const approvedIds = new Set<string>(
      (pendingVotesRes.data ?? [])
        .filter((r: { pending_bet_id: string; vote: string }) => r.vote === "approve")
        .map((r: { pending_bet_id: string }) => r.pending_bet_id),
    );
    const rejectedIds = new Set<string>(
      (pendingVotesRes.data ?? [])
        .filter((r: { pending_bet_id: string; vote: string }) => r.vote === "reject")
        .map((r: { pending_bet_id: string }) => r.pending_bet_id),
    );
    approvedPendingIdsRef.current = approvedIds;
    rejectedPendingIdsRef.current = rejectedIds;
    setPending((pendingRes.data ?? []).map((r: DbPendingBet) => mapPendingBet(r, approvedIds, rejectedIds)));
  }, []);

  const refreshBets = useCallback(async (username: string) => {
    const [betsRes, placementsRes, betVotesRes, disputeVotesRes, allPlacementsRes] = await Promise.all([
      supabase.from("bets").select("*").order("created_at", { ascending: false }),
      supabase.from("bet_placements").select("bet_id, amount, locked_odd").eq("user_id", username),
      supabase.from("bet_votes").select("bet_id, vote").eq("user_id", username),
      supabase.from("bet_dispute_votes").select("bet_id, vote").eq("user_id", username),
      supabase.from("bet_placements").select("bet_id, user_id, amount, locked_odd"),
    ]);
    const placedMap = new Map<string, PlacedBet>(
      (placementsRes.data ?? []).map((r: { bet_id: string; amount: number; locked_odd?: number | null }) => [
        r.bet_id,
        { amount: r.amount, odd: Number(r.locked_odd ?? 1.01) },
      ] as [string, PlacedBet]),
    );
    const votedMap = new Map<string, "happened" | "not" | "unsure">(
      (betVotesRes.data ?? []).map((r: { bet_id: string; vote: string }) => [r.bet_id, r.vote as "happened" | "not" | "unsure"] as [string, "happened" | "not" | "unsure"]),
    );
    const disputeVotedMap = new Map<string, "approve" | "reject">(
      (disputeVotesRes.data ?? []).map((r: { bet_id: string; vote: string }) => [r.bet_id, r.vote as "approve" | "reject"] as [string, "approve" | "reject"]),
    );
    const topPlacerMap = new Map<string, { userId: string; amount: number }>();
    for (const p of (allPlacementsRes.data ?? []) as DbBetPlacement[]) {
      const cur = topPlacerMap.get(p.bet_id);
      if (!cur || p.amount > cur.amount) topPlacerMap.set(p.bet_id, { userId: p.user_id, amount: p.amount });
    }
    placedMapRef.current = placedMap;
    votedMapRef.current = votedMap;
    disputeVotedMapRef.current = disputeVotedMap;
    topPlacerMapRef.current = topPlacerMap;
    setAllPlacements(((allPlacementsRes.data ?? []) as DbBetPlacement[]).map(mapBetPlacement));
    setBets((betsRes.data ?? []).map((r: DbBet) => mapBet(r, placedMap, votedMap, disputeVotedMap, topPlacerMap)));
  }, []);

  const refreshGroupMembers = useCallback(async () => {
    const { data } = await supabase.from("group_members").select("group_id, user_id");
    setGroupMembers(groupMembersByGroup((data ?? []) as DbGroupMember[]));
  }, []);

  const refreshPlayerStats = useCallback(async () => {
    const { data } = await supabase.from("users").select("id, balance, bet_count");
    const stats: Record<string, PlayerStats> = {};
    for (const u of (data ?? []) as DbUser[]) {
      stats[u.id] = { balance: u.balance, betCount: u.bet_count };
    }
    setPlayerStats(stats);
  }, []);

  // ─── Restore session on mount ─────────────────────────────────────────────────

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setUser({ name: session.username });
      saveSession(session.username);
    }
    setAuthReady(true);
  }, []);

  // ─── Load data when user logs in ──────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    loadUserData(user.name);
  }, [user, loadUserData]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const username = user.name;

    const channel = supabase
      .channel(`merdabet-${username}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const g = mapGroup(payload.new as DbGroup);
          setGroups((prev) => {
            if (prev.some((x) => x.id === g.id)) return prev;
            return [g, ...prev];
          });
        } else if (payload.eventType === "DELETE") {
          setGroups((prev) => prev.filter((x) => x.id !== (payload.old as { id: string }).id));
        } else if (payload.eventType === "UPDATE") {
          const g = mapGroup(payload.new as DbGroup);
          setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)));
        }
        refreshGroupMembers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        refreshGroupMembers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, () => {
        refreshParties(username);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_bets" }, () => {
        refreshPending(username);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => {
        refreshBets(username);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bet_placements" }, () => {
        refreshBets(username);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "esmolas" }, () => {
        supabase
          .from("esmolas")
          .select("*")
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            if (data) setEsmolas(data.map(mapEsmola));
          });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        refreshPlayerStats();
        // Also update own balance if it changed
        supabase
          .from("users")
          .select("balance")
          .eq("id", username)
          .single()
          .then(({ data }) => {
            if (data) setBalance((data as { balance: number }).balance);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshGroupMembers, refreshParties, refreshPending, refreshBets, refreshPlayerStats]);

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  const login = useCallback(async (name: string, password: string): Promise<string | null> => {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, password, balance")
      .eq("id", name)
      .single();

    if (existingUser) {
      if ((existingUser as { password: string }).password !== password) {
        return "Senha incorreta para este usuário.";
      }
      setUser({ name });
      setBalance((existingUser as { balance: number }).balance);
      saveSession(name);
      return null;
    }

    // New user
    const { error } = await supabase.from("users").insert({ id: name, password, balance: 50, bet_count: 0 });
    if (error) return `Erro ao criar usuário: ${error.message}`;

    setUser({ name });
    setBalance(50);
    saveSession(name);
    return null;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setBalance(0);
    setGroups([]);
    setJoined([]);
    setParties([]);
    setPending([]);
    setBets([]);
    setEsmolas([]);
    setPlayerStats({});
    setGroupMembers({});
    setAllPlacements([]);
    clearSession();
  }, []);

  const addBalance = useCallback(
    (n: number) => {
      setBalance((b) => b + n);
      if (user) {
        const newBal = balance + n;
        supabase.from("users").update({ balance: newBal }).eq("id", user.name).then(() => {});
      }
    },
    [user, balance],
  );

  const spend = useCallback(
    (n: number): boolean => {
      if (balance < n) return false;
      const newBal = balance - n;
      setBalance(newBal);
      if (user) {
        supabase.from("users").update({ balance: newBal }).eq("id", user.name).then(() => {});
      }
      return true;
    },
    [balance, user],
  );

  // ─── Groups ───────────────────────────────────────────────────────────────────

  const createGroup = useCallback(
    (name: string, password: string): Group => {
      const g: Group = {
        id: `g${Date.now()}`,
        name,
        password,
        createdBy: user?.name ?? "",
        members: 1,
      };
      setGroups((prev) => [g, ...prev]);
      setJoined((prev) => [g.id, ...prev]);
      if (user) {
        setGroupMembers((prev) => ({
          ...prev,
          [g.id]: [user.name],
        }));
      }
      supabase
        .from("groups")
        .insert({ id: g.id, name: g.name, password: g.password, created_by: g.createdBy, members: 1 })
        .then(() => {
          if (user) {
            supabase.from("group_members").insert({ group_id: g.id, user_id: user.name }).then(() => {});
          }
        });
      return g;
    },
    [user],
  );

  const joinGroup = useCallback(
    (id: string) => {
      if (!user) return;
      if (joinedGroupIds.includes(id)) return;
      setJoined((prev) => [...prev, id]);
      setGroupMembers((prev) => {
        const members = new Set(prev[id] ?? []);
        members.add(user.name);
        return { ...prev, [id]: [...members].sort((a, b) => a.localeCompare(b)) };
      });
      const currentMembers = groups.find((g) => g.id === id)?.members ?? 0;
      const newMembers = currentMembers + 1;
      const newNeeded = Math.max(1, Math.ceil(newMembers / 3));
      setGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, members: newMembers } : g)),
      );
      // Recalculate needed for all pending bets and active disputes in this group
      const groupPartyIds = parties.filter((p) => p.groupId === id).map((p) => p.id);
      setPending((prev) =>
        prev.map((pb) =>
          groupPartyIds.includes(pb.partyId) ? { ...pb, needed: newNeeded } : pb,
        ),
      );
      setBets((prev) =>
        prev.map((b) =>
          groupPartyIds.includes(b.partyId) && b.disputeStatus === "pending"
            ? { ...b, disputeNeeded: newNeeded }
            : b,
        ),
      );
      supabase.from("group_members").insert({ group_id: id, user_id: user.name }).then(() => {});
      supabase.from("groups").update({ members: newMembers }).eq("id", id).then(() => {});
      if (groupPartyIds.length > 0) {
        supabase.from("pending_bets").update({ needed: newNeeded }).in("party_id", groupPartyIds).then(() => {});
        supabase.from("bets").update({ dispute_needed: newNeeded }).in("party_id", groupPartyIds).eq("dispute_status", "pending").then(() => {});
      }
    },
    [user, groups, joinedGroupIds, parties],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setJoined((prev) => prev.filter((x) => x !== id));
      setParties((prev) => prev.filter((p) => p.groupId !== id));
      setGroupMembers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      supabase.from("groups").delete().eq("id", id).then(() => {});
    },
    [],
  );

  const updateGroup = useCallback(
    (id: string, name: string, password: string) => {
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name, password } : g)));
      supabase.from("groups").update({ name, password }).eq("id", id).then(() => {});
    },
    [],
  );

  // ─── Parties ──────────────────────────────────────────────────────────────────

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
      setParties((prev) => [p, ...prev]);
      supabase
        .from("parties")
        .insert({
          id: p.id,
          group_id: groupId,
          name,
          start_time: start,
          end_time: end,
          status: "pending",
          attendees: 0,
        })
        .then(() => {});
    },
    [],
  );

  const confirmAttendance = useCallback(
    (partyId: string) => {
      if (!user) return;
      attendedIdsRef.current = new Set([...attendedIdsRef.current, partyId]);
      const currentAttendees = parties.find((p) => p.id === partyId)?.attendees ?? 0;
      setParties((prev) =>
        prev.map((p) =>
          p.id === partyId
            ? { ...p, attending: true, attendees: p.attendees + 1 }
            : p,
        ),
      );
      const newBal = balance + 10;
      setBalance(newBal);
      supabase.from("party_attendees").insert({ party_id: partyId, user_id: user.name }).then(() => {});
      supabase.from("parties").update({ attendees: currentAttendees + 1 }).eq("id", partyId).then(() => {});
      supabase.from("users").update({ balance: newBal }).eq("id", user.name).then(() => {});
    },
    [user, balance, parties],
  );

  // ─── Pending bets ─────────────────────────────────────────────────────────────

  const suggestBet = useCallback(
    (partyId: string, description: string, odd: number) => {
      if (!user) return;
      const party = parties.find((p) => p.id === partyId);
      const group = groups.find((g) => g.id === party?.groupId);
      const members = group?.members ?? 1;
      const needed = Math.max(1, Math.ceil(members / 3));
      const pb: PendingBet = {
        id: `pb${Date.now()}`,
        partyId,
        description,
        odd,
        approvals: 0,
        rejections: 0,
        needed,
      };
      setPending((prev) => [pb, ...prev]);
      supabase
        .from("pending_bets")
        .insert({ id: pb.id, party_id: partyId, description, odd, approvals: 0, rejections: 0, needed })
        .then(() => {});
    },
    [user, parties, groups],
  );

  const votePending = useCallback(
    (id: string, vote: "approve" | "reject") => {
      if (!user) return;

      setPending((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== id) return p;
          if (p.approvedByMe || p.rejectedByMe) return p;
          const newApprovals = vote === "approve" ? p.approvals + 1 : p.approvals;
          const newRejections = vote === "reject" ? (p.rejections ?? 0) + 1 : (p.rejections ?? 0);
          return {
            ...p,
            approvals: newApprovals,
            rejections: newRejections,
            approvedByMe: vote === "approve" ? true : p.approvedByMe,
            rejectedByMe: vote === "reject" ? true : p.rejectedByMe,
          };
        });

        const promoted = updated.find((p) => p.id === id && p.approvals >= p.needed);
        if (promoted) {
          const newBet: Bet = {
            id: `b${Date.now()}`,
            partyId: promoted.partyId,
            description: promoted.description,
            odd: promoted.odd,
            initialOdd: promoted.odd,
            votesHappened: 0,
            votesNot: 0,
            placementsCount: 0,
            totalWagered: 0,
            disputeApprovals: 0,
            disputeRejections: 0,
            disputeNeeded: 1,
            disputeStatus: "none",
          };
          setBets((bs) => [newBet, ...bs]);
          supabase
            .from("bets")
            .insert({
              id: newBet.id,
              party_id: promoted.partyId,
              description: promoted.description,
              odd: promoted.odd,
              votes_happened: 0,
              votes_not: 0,
              placements_count: 0,
            })
            .then(() => {
              supabase.from("pending_bets").delete().eq("id", id).then(() => {});
            });
          return updated.filter((p) => p.id !== id);
        }

        // Enough rejections → cancel the bet
        const cancelled = updated.find((p) => p.id === id && (p.rejections ?? 0) >= p.needed);
        if (cancelled) {
          supabase.from("pending_bets").delete().eq("id", id).then(() => {});
          return updated.filter((p) => p.id !== id);
        }

        return updated;
      });

      // Record user's vote in DB
      supabase
        .from("pending_bet_votes")
        .insert({ pending_bet_id: id, user_id: user.name, vote })
        .then(() => {});

      const target = pending.find((p) => p.id === id);
      if (vote === "approve") {
        const currentApprovals = target?.approvals ?? 0;
        supabase.from("pending_bets").update({ approvals: currentApprovals + 1 }).eq("id", id).then(() => {});
      } else {
        const currentRejections = target?.rejections ?? 0;
        supabase.from("pending_bets").update({ rejections: currentRejections + 1 }).eq("id", id).then(() => {});
      }

      if (vote === "approve") {
        approvedPendingIdsRef.current = new Set([...approvedPendingIdsRef.current, id]);
      } else {
        rejectedPendingIdsRef.current = new Set([...rejectedPendingIdsRef.current, id]);
      }
    },
    [user, pending],
  );

  // ─── Live bets ────────────────────────────────────────────────────────────────

  const placeBet = useCallback(
    (betId: string, amount: number) => {
      if (!user) return;
      const lockedOdd = bets.find((b) => b.id === betId)?.odd ?? 1.01;
      const placed: PlacedBet = { amount, odd: lockedOdd };
      placedMapRef.current = new Map([...placedMapRef.current, [betId, placed]]);
      setAllPlacements((prev) => [
        ...prev.filter((placement) => !(placement.betId === betId && placement.userId === user.name)),
        { betId, userId: user.name, amount, odd: lockedOdd },
      ]);
      setBets((prev) =>
        prev.map((b) => {
          if (b.id !== betId) return b;
          const newTopPlacer =
            !b.topPlacer || amount > b.topPlacer.amount
              ? { userId: user.name, amount }
              : b.topPlacer;
          topPlacerMapRef.current.set(betId, newTopPlacer);
          return { ...b, placed, placementsCount: b.placementsCount + 1, totalWagered: b.totalWagered + amount, topPlacer: newTopPlacer };
        }),
      );
      const newBetCount = (playerStats[user.name]?.betCount ?? 0) + 1;
      setPlayerStats((s) => ({
        ...s,
        [user.name]: { balance: s[user.name]?.balance ?? balance, betCount: newBetCount },
      }));
      supabase
        .from("bet_placements")
        .insert({ bet_id: betId, user_id: user.name, amount })
        .then(() => {});
      supabase
        .from("users")
        .update({ bet_count: newBetCount })
        .eq("id", user.name)
        .then(() => {});
    },
    [user, playerStats, balance, bets],
  );

  const voteBet = useCallback(
    (betId: string, vote: "happened" | "not" | "unsure"): VoteBetResult => {
      const bet = bets.find((b) => b.id === betId);
      if (!bet || bet.voted || !user) {
        return { resolved: false, won: false, winnings: 0, description: "" };
      }

      const newVotesHappened = vote === "happened" ? bet.votesHappened + 1 : bet.votesHappened;
      const newVotesNot = vote === "not" ? bet.votesNot + 1 : bet.votesNot;

      let outcome: "happened" | "not" | undefined;
      if (newVotesHappened >= 2) outcome = "happened";
      else if (newVotesNot >= 2) outcome = "not";

      let won = false;
      let winnings = 0;

      if (outcome && bet.placed) {
        won = outcome === "happened";
        if (won) {
          winnings = Math.round(bet.placed.amount * bet.placed.odd);
          const newBal = balance + winnings;
          setBalance(newBal);
          setPlayerStats((s) => ({
            ...s,
            [user.name]: { ...s[user.name], balance: newBal },
          }));
          supabase.from("users").update({ balance: newBal }).eq("id", user.name).then(() => {});
        }
      }

      votedMapRef.current = new Map([...votedMapRef.current, [betId, vote]]);
      setBets((prev) =>
        prev.map((b) =>
          b.id === betId
            ? { ...b, votesHappened: newVotesHappened, votesNot: newVotesNot, voted: vote, resolved: outcome }
            : b,
        ),
      );

      // DB updates
      supabase
        .from("bet_votes")
        .insert({ bet_id: betId, user_id: user.name, vote })
        .then(() => {});
      supabase
        .from("bets")
        .update({
          votes_happened: newVotesHappened,
          votes_not: newVotesNot,
          ...(outcome ? { resolved: outcome } : {}),
        })
        .eq("id", betId)
        .then(() => {});

      return { resolved: !!outcome, outcome, won, winnings, description: bet.description };
    },
    [bets, user, balance],
  );

  // ─── Dispute ─────────────────────────────────────────────────────────────────

  const requestDispute = useCallback(
    (betId: string, type: "change_odd" | "delete", newOdd?: number) => {
      if (!user) return;
      const bet = bets.find((b) => b.id === betId);
      if (!bet || bet.disputeStatus !== "none") return;

      const party = parties.find((p) => p.id === bet.partyId);
      const group = groups.find((g) => g.id === party?.groupId);
      const members = group?.members ?? 1;
      const needed = Math.max(1, Math.ceil(members / 3));

      setBets((prev) =>
        prev.map((b) =>
          b.id === betId
            ? { ...b, disputeType: type, disputeNewOdd: newOdd, disputeApprovals: 0, disputeRejections: 0, disputeNeeded: needed, disputeStatus: "pending" }
            : b,
        ),
      );
      supabase
        .from("bets")
        .update({ dispute_type: type, dispute_new_odd: newOdd ?? null, dispute_approvals: 0, dispute_rejections: 0, dispute_needed: needed, dispute_status: "pending" })
        .eq("id", betId)
        .then(() => {});
    },
    [user, bets, parties, groups],
  );

  const voteDispute = useCallback(
    (betId: string, vote: "approve" | "reject") => {
      if (!user) return;
      const bet = bets.find((b) => b.id === betId);
      if (!bet || bet.disputeStatus !== "pending" || bet.disputeVotedByMe) return;

      const newApprovals = vote === "approve" ? bet.disputeApprovals + 1 : bet.disputeApprovals;
      const newRejections = vote === "reject" ? bet.disputeRejections + 1 : bet.disputeRejections;

      let newStatus: Bet["disputeStatus"] = "pending";
      if (newApprovals >= bet.disputeNeeded) newStatus = "approved";
      else if (newRejections >= bet.disputeNeeded) newStatus = "rejected";

      disputeVotedMapRef.current = new Map([...disputeVotedMapRef.current, [betId, vote]]);
      supabase.from("bet_dispute_votes").insert({ bet_id: betId, user_id: user.name, vote }).then(() => {});

      if (newStatus === "approved" && bet.disputeType === "delete") {
        if (bet.placed) {
          const refundedBal = balance + bet.placed.amount;
          setBalance(refundedBal);
          supabase.from("users").update({ balance: refundedBal }).eq("id", user.name).then(() => {});
        }
        setBets((prev) => prev.filter((b) => b.id !== betId));
        // Refund all placers then delete the bet
        supabase
          .from("bet_placements")
          .select("user_id, amount")
          .eq("bet_id", betId)
          .then(({ data }) => {
            if (data) {
              for (const p of data as { user_id: string; amount: number }[]) {
                supabase
                  .from("users")
                  .select("balance")
                  .eq("id", p.user_id)
                  .single()
                  .then(({ data: u }) => {
                    if (u) supabase.from("users").update({ balance: (u as { balance: number }).balance + p.amount }).eq("id", p.user_id).then(() => {});
                  });
              }
            }
            supabase.from("bets").delete().eq("id", betId).then(() => {});
          });
      } else if (newStatus === "approved" && bet.disputeType === "change_odd") {
        const updatedOdd = bet.disputeNewOdd ?? bet.odd;
        setBets((prev) =>
          prev.map((b) =>
            b.id === betId
              ? { ...b, odd: updatedOdd, disputeStatus: "approved", disputeApprovals: newApprovals, disputeVotedByMe: vote }
              : b,
          ),
        );
        supabase
          .from("bets")
          .update({ odd: updatedOdd, dispute_status: "approved", dispute_approvals: newApprovals })
          .eq("id", betId)
          .then(() => {});
      } else {
        setBets((prev) =>
          prev.map((b) =>
            b.id === betId
              ? { ...b, disputeApprovals: newApprovals, disputeRejections: newRejections, disputeStatus: newStatus, disputeVotedByMe: vote }
              : b,
          ),
        );
        supabase
          .from("bets")
          .update({ dispute_approvals: newApprovals, dispute_rejections: newRejections, dispute_status: newStatus })
          .eq("id", betId)
          .then(() => {});
      }
    },
    [bets, user, balance],
  );

  // ─── Esmola ───────────────────────────────────────────────────────────────────

  const requestEsmola = useCallback(
    (groupId: string, amount: number) => {
      if (!user) return;
      const e: Esmola = { id: `e${Date.now()}`, groupId, user: user.name, amount, donated: false };
      setEsmolas((prev) => [e, ...prev]);
      supabase
        .from("esmolas")
        .insert({ id: e.id, group_id: groupId, user_id: user.name, amount, donated: false })
        .then(() => {});
    },
    [user],
  );

  const donateEsmola = useCallback((id: string) => {
    setEsmolas((prev) => prev.map((e) => (e.id === id ? { ...e, donated: true } : e)));
    supabase.from("esmolas").update({ donated: true }).eq("id", id).then(() => {});
  }, []);

  const getGroupMemberInsights = useCallback(
    (groupId: string): GroupMemberInsight[] => {
      const group = groups.find((g) => g.id === groupId);
      const memberIds = new Set(groupMembers[groupId] ?? []);
      if (group?.createdBy) memberIds.add(group.createdBy);

      const partyIds = new Set(
        parties
          .filter((party) => party.groupId === groupId)
          .map((party) => party.id),
      );
      const activeBets = new Map(
        bets
          .filter((bet) => partyIds.has(bet.partyId) && !bet.resolved)
          .map((bet) => [bet.id, bet]),
      );
      const totals = new Map<string, { activeBets: number; activeStake: number; potentialReturn: number }>();

      for (const placement of allPlacements) {
        if (!activeBets.has(placement.betId)) continue;
        const current = totals.get(placement.userId) ?? {
          activeBets: 0,
          activeStake: 0,
          potentialReturn: 0,
        };
        current.activeBets += 1;
        current.activeStake += placement.amount;
        current.potentialReturn += Math.round(placement.amount * placement.odd);
        totals.set(placement.userId, current);
        memberIds.add(placement.userId);
      }

      return [...memberIds]
        .map((userId) => {
          const total = totals.get(userId);
          const stats = playerStats[userId];
          return {
            userId,
            balance: stats?.balance ?? 0,
            betCount: stats?.betCount ?? 0,
            activeBets: total?.activeBets ?? 0,
            activeStake: total?.activeStake ?? 0,
            potentialReturn: total?.potentialReturn ?? 0,
          };
        })
        .sort((a, b) => {
          if (b.potentialReturn !== a.potentialReturn) return b.potentialReturn - a.potentialReturn;
          if (b.balance !== a.balance) return b.balance - a.balance;
          return a.userId.localeCompare(b.userId);
        });
    },
    [allPlacements, bets, groupMembers, groups, parties, playerStats],
  );

  // ─── Context value ────────────────────────────────────────────────────────────

  const value = useMemo<Ctx>(
    () => ({
      user, authReady, balance, login, logout, addBalance, spend,
      groups, joinedGroupIds, createGroup, joinGroup, deleteGroup, updateGroup,
      parties, addParty, confirmAttendance,
      pending, votePending, suggestBet,
      bets, placeBet, voteBet, requestDispute, voteDispute,
      playerStats, getGroupMemberInsights,
      esmolas, requestEsmola, donateEsmola,
    }),
    [
      user, authReady, balance, login, logout, addBalance, spend,
      groups, joinedGroupIds, createGroup, joinGroup, deleteGroup, updateGroup,
      parties, addParty, confirmAttendance,
      pending, votePending, suggestBet,
      bets, placeBet, voteBet, requestDispute, voteDispute,
      playerStats, getGroupMemberInsights,
      esmolas, requestEsmola, donateEsmola,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
