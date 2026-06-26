export type PartyStatus = "pending" | "live" | "ended";

export type Bet = {
  id: string;
  partyId: string;
  description: string;
  oddFor: number;
  oddAgainst: number;
  placed?: { side: "for" | "against"; amount: number };
  voted?: "happened" | "not";
};

export type PendingBet = {
  id: string;
  partyId: string;
  description: string;
  oddFor: number;
  oddAgainst: number;
  approvals: number;
  needed: number;
  approvedByMe?: boolean;
  rejectedByMe?: boolean;
};

export type Party = {
  id: string;
  groupId: string;
  name: string;
  start: string;
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

export const initialGroups: Group[] = [];
export const initialEsmolas: Esmola[] = [];
export const initialParties: Party[] = [];
export const initialPending: PendingBet[] = [];
export const initialBets: Bet[] = [];
