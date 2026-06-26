export type PartyStatus = "pending" | "live" | "ended";

export type Bet = {
  id: string;
  partyId: string;
  description: string;
  oddFor: number;
  oddAgainst: number;
  // user's placed bet, if any
  placed?: { side: "for" | "against"; amount: number };
  // resolution voting
  voted?: "happened" | "not";
};

export type PendingBet = {
  id: string;
  partyId: string;
  description: string;
  approvals: number;
  needed: number;
  approvedByMe?: boolean;
};

export type Party = {
  id: string;
  groupId: string;
  name: string;
  start: string; // ISO
  end: string;
  status: PartyStatus;
  attending?: boolean;
};

export type Esmola = {
  id: string;
  groupId: string;
  user: string;
  amount: number;
  donated?: boolean;
};

export type Group = {
  id: string;
  name: string;
  members: number;
  password: string;
};

export const initialGroups: Group[] = [
  { id: "g1", name: "Grupo da Galera", members: 7, password: "1234" },
  { id: "g2", name: "Festa da Facul", members: 14, password: "1234" },
  { id: "g3", name: "Os Resenheiros", members: 5, password: "1234" },
];

export const initialEsmolas: Esmola[] = [
  { id: "e1", groupId: "g1", user: "Tonhão", amount: 10 },
  { id: "e2", groupId: "g1", user: "Bia", amount: 5 },
  { id: "e3", groupId: "g2", user: "Lucão", amount: 15 },
];

const now = Date.now();
const inMin = (m: number) => new Date(now + m * 60_000).toISOString();

export const initialParties: Party[] = [
  {
    id: "p1",
    groupId: "g1",
    name: "Esquenta no Zé",
    start: inMin(30),
    end: inMin(240),
    status: "pending",
  },
  {
    id: "p2",
    groupId: "g1",
    name: "Rolê na Vila",
    start: inMin(-60),
    end: inMin(120),
    status: "live",
  },
  {
    id: "p3",
    groupId: "g1",
    name: "Aniversário da Mari",
    start: inMin(-300),
    end: inMin(-30),
    status: "ended",
  },
  {
    id: "p4",
    groupId: "g2",
    name: "Festa Junina da Facul",
    start: inMin(60),
    end: inMin(360),
    status: "pending",
  },
];

export const initialPending: PendingBet[] = [
  {
    id: "pb1",
    partyId: "p2",
    description: "O Jorginho vai cair da escada",
    approvals: 2,
    needed: 3,
  },
  {
    id: "pb2",
    partyId: "p2",
    description: "Alguém vai chamar o ex às 3 da manhã",
    approvals: 1,
    needed: 3,
  },
];

export const initialBets: Bet[] = [
  {
    id: "b1",
    partyId: "p2",
    description: "Alguém vai dar PT antes da meia-noite",
    oddFor: 1.85,
    oddAgainst: 2.1,
  },
  {
    id: "b2",
    partyId: "p2",
    description: "Vai rolar BO com o vizinho",
    oddFor: 2.5,
    oddAgainst: 1.55,
  },
  {
    id: "b3",
    partyId: "p2",
    description: "DJ vai tocar Pagode até o fim",
    oddFor: 1.4,
    oddAgainst: 2.9,
  },
  // for ended party — voting tab
  {
    id: "b4",
    partyId: "p3",
    description: "Carlão vai ficar com a Bia",
    oddFor: 1.95,
    oddAgainst: 1.95,
  },
  {
    id: "b5",
    partyId: "p3",
    description: "Polícia foi chamada",
    oddFor: 3.2,
    oddAgainst: 1.3,
  },
];
