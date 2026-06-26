export type PartyStatus = "pending" | "live" | "ended";

export type Bet = {
  id: string;
  partyId: string;
  description: string;
  odd: number;
  placed?: { amount: number };
  voted?: "happened" | "not";
  votesHappened: number;
  votesNot: number;
  resolved?: "happened" | "not";
  placementsCount: number;
  totalWagered: number;
  // Dispute fields
  disputeType?: "change_odd" | "delete";
  disputeNewOdd?: number;
  disputeApprovals: number;
  disputeRejections: number;
  disputeNeeded: number;
  disputeStatus: "none" | "pending" | "approved" | "rejected";
  disputeVotedByMe?: "approve" | "reject";
};

export type PendingBet = {
  id: string;
  partyId: string;
  description: string;
  odd: number;
  approvals: number;
  rejections: number;
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
  attendees: number;
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
  createdBy: string;
};

export function isEnded(party: Party): boolean {
  return new Date(party.end).getTime() < Date.now();
}

export const initialGroups: Group[] = [];
export const initialEsmolas: Esmola[] = [];
export const initialParties: Party[] = [];
export const initialPending: PendingBet[] = [];
export const initialBets: Bet[] = [];
