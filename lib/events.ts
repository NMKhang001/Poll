import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { sorobanRpc } from "./soroban";

const VOTE_TOPIC = "vote";
const FINAL_TOPIC = "final";
const RELEASE_TOPIC = "release";
const CREATED_TOPIC = "created";

export type VoteEvent = {
  kind: "vote";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  voter: string;
  pollId: number;
  optionIdx: number;
  stake: bigint;
  weight: bigint;
};

export type FinalEvent = {
  kind: "final";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  creator: string;
  pollId: number;
  winner: number;
  topWeight: bigint;
};

export type ReleaseEvent = {
  kind: "release";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  voter: string;
  pollId: number;
  stake: bigint;
};

export type CreatedEvent = {
  kind: "created";
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  creator: string;
  pollId: number;
  question: string;
  numOptions: number;
  deadline: bigint;
};

export type ContractEvent = VoteEvent | FinalEvent | ReleaseEvent | CreatedEvent;

export async function getRecentEvents(
  contractId: string,
  windowLedgers = 5000
): Promise<ContractEvent[]> {
  const latest = await sorobanRpc.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - windowLedgers);

  const voteSym = xdr.ScVal.scvSymbol(VOTE_TOPIC).toXDR("base64");
  const finalSym = xdr.ScVal.scvSymbol(FINAL_TOPIC).toXDR("base64");
  const releaseSym = xdr.ScVal.scvSymbol(RELEASE_TOPIC).toXDR("base64");
  const createdSym = xdr.ScVal.scvSymbol(CREATED_TOPIC).toXDR("base64");

  const res = await sorobanRpc.getEvents({
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
        topics: [
          [voteSym, "*"],
          [finalSym, "*"],
          [releaseSym, "*"],
          [createdSym, "*"],
        ],
      },
    ],
    limit: 80,
  });

  const decoded: ContractEvent[] = [];
  for (const e of res.events) {
    const ev = decodeEvent(e);
    if (ev) decoded.push(ev);
  }
  return decoded.reverse();
}

export async function getVoteEvents(
  contractId: string,
  windowLedgers = 5000
): Promise<VoteEvent[]> {
  const all = await getRecentEvents(contractId, windowLedgers);
  return all.filter((e): e is VoteEvent => e.kind === "vote");
}

function decodeEvent(e: rpc.Api.EventResponse): ContractEvent | null {
  const topicSym = scValToNative(e.topic[0]) as string;
  const base = {
    id: e.id,
    ledger: e.ledger,
    ledgerClosedAt: e.ledgerClosedAt,
    txHash: e.txHash,
  };

  try {
    if (topicSym === VOTE_TOPIC) {
      const voter = scValToNative(e.topic[1]) as string;
      const value = scValToNative(e.value) as [number, number, bigint, bigint];
      return {
        ...base,
        kind: "vote",
        voter,
        pollId: Number(value[0]),
        optionIdx: Number(value[1]),
        stake: BigInt(value[2]),
        weight: BigInt(value[3]),
      };
    }
    if (topicSym === FINAL_TOPIC) {
      const creator = scValToNative(e.topic[1]) as string;
      const value = scValToNative(e.value) as [number, number, bigint];
      return {
        ...base,
        kind: "final",
        creator,
        pollId: Number(value[0]),
        winner: Number(value[1]),
        topWeight: BigInt(value[2]),
      };
    }
    if (topicSym === RELEASE_TOPIC) {
      const voter = scValToNative(e.topic[1]) as string;
      const value = scValToNative(e.value) as [number, bigint];
      return {
        ...base,
        kind: "release",
        voter,
        pollId: Number(value[0]),
        stake: BigInt(value[1]),
      };
    }
    if (topicSym === CREATED_TOPIC) {
      const creator = scValToNative(e.topic[1]) as string;
      const value = scValToNative(e.value) as [number, string, number, bigint];
      return {
        ...base,
        kind: "created",
        creator,
        pollId: Number(value[0]),
        question: String(value[1]),
        numOptions: Number(value[2]),
        deadline: BigInt(value[3]),
      };
    }
  } catch {
    return null;
  }
  return null;
}
