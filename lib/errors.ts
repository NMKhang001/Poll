export class WalletNotFoundError extends Error {
  readonly code = "wallet_not_found";
  constructor(message = "no stellar wallet found in the browser") {
    super(message);
    this.name = "WalletNotFoundError";
  }
}

export class UserRejectedError extends Error {
  readonly code = "user_rejected";
  constructor(message = "user rejected the request") {
    super(message);
    this.name = "UserRejectedError";
  }
}

export class InsufficientBalanceError extends Error {
  readonly code = "insufficient_balance";
  constructor(message = "not enough xlm to cover this transaction") {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

function readableMessage(e: unknown): string {
  if (e == null) return "unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    // common shapes from stellar-wallets-kit / soroban rpc
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.error === "object" && obj.error !== null) {
      const inner = obj.error as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
    }
    try {
      const s = JSON.stringify(e);
      if (s && s !== "{}") return s;
    } catch {
      // fall through
    }
  }
  return String(e);
}

const POLL_CONTRACT_ERRORS: Record<number, string> = {
  1: "Stake must be greater than zero.",
  2: "Poll not found.",
  3: "This poll is closed.",
  4: "This poll has not ended yet.",
  5: "This poll is already finalized.",
  6: "You already voted on this poll.",
  7: "Invalid option.",
  8: "Poll is not finalized yet.",
  9: "Stake already released.",
  10: "No vote found for this address.",
  11: "Polls need between 2 and 6 options.",
  12: "Voting window must be greater than zero.",
  13: "Contract is not initialized.",
  14: "Question is required.",
  15: "Option text is required.",
};

export function decodeContractError(message: string): string | null {
  const m = message.match(/Error\(Contract,\s*#(\d+)\)/i);
  if (!m) return null;
  const code = Number(m[1]);
  return POLL_CONTRACT_ERRORS[code] ?? `Contract error #${code}.`;
}

export function toError(e: unknown): Error {
  const message = readableMessage(e);
  const lower = message.toLowerCase();
  const contractMsg = decodeContractError(message);
  if (contractMsg) {
    return new Error(contractMsg);
  }
  if (
    lower.includes("rejected") ||
    lower.includes("declined") ||
    lower.includes("denied") ||
    lower.includes("user did not") ||
    lower.includes("user closed") ||
    lower.includes("dismissed")
  ) {
    return new UserRejectedError(message);
  }
  if (
    lower.includes("insufficient") ||
    lower.includes("underfunded") ||
    lower.includes("op_underfunded")
  ) {
    return new InsufficientBalanceError(message);
  }
  if (
    lower.includes("no wallet") ||
    lower.includes("not installed") ||
    lower.includes("wallet not found")
  ) {
    return new WalletNotFoundError(message);
  }
  if (e instanceof Error) return e;
  return new Error(message);
}
