import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { networkPassphrase } from "./stellar";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

const READ_SOURCE =
  process.env.NEXT_PUBLIC_READ_SOURCE ??
  "GBZGPMRLYDWCC6GKX5B7HYFYQWZOUHND3RMGGR5R7TYEA7SE7QGZ5QO7";

export const sorobanRpc = new rpc.Server(RPC_URL);

export type ScArg = xdr.ScVal;

export function addrArg(s: string): ScArg {
  return new Address(s).toScVal();
}

export function i128Arg(stroops: bigint): ScArg {
  return nativeToScVal(stroops, { type: "i128" });
}

export function u32Arg(n: number): ScArg {
  return nativeToScVal(n, { type: "u32" });
}

export function u64Arg(n: number | bigint): ScArg {
  return nativeToScVal(BigInt(n), { type: "u64" });
}

export function strArg(s: string): ScArg {
  return nativeToScVal(s, { type: "string" });
}

export function vecStrArg(items: string[]): ScArg {
  return xdr.ScVal.scvVec(items.map((s) => strArg(s)));
}

export async function invokeContract(opts: {
  contractId: string;
  method: string;
  args: ScArg[];
  source: string;
  signXdr: (xdr: string) => Promise<string>;
}): Promise<{ hash: string }> {
  const account = await sorobanRpc.getAccount(opts.source);
  const contract = new Contract(opts.contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(opts.method, ...opts.args))
    .setTimeout(30)
    .build();

  const sim = await sorobanRpc.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.error("[soroban] simulation error:", sim);
    throw new Error(`simulation failed: ${sim.error}`);
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();

  let signedXdr: string;
  try {
    signedXdr = await opts.signXdr(prepared.toXDR());
  } catch (e) {
    console.error("[soroban] signing error:", e);
    throw e;
  }
  const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  const sendRes = await sorobanRpc.sendTransaction(signed);
  if (sendRes.status === "ERROR") {
    console.error("[soroban] sendTransaction error:", sendRes);
    throw new Error(
      `send failed: ${
        sendRes.errorResult ? JSON.stringify(sendRes.errorResult) : sendRes.status
      }`
    );
  }
  const hash = sendRes.hash;

  let result = await sorobanRpc.getTransaction(hash);
  let tries = 0;
  while (result.status === "NOT_FOUND" && tries < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await sorobanRpc.getTransaction(hash);
    tries++;
  }
  if (result.status === "FAILED") {
    console.error("[soroban] tx failed on chain:", result);
    throw new Error(`contract call failed on chain (tx ${hash})`);
  }
  return { hash };
}

export async function readContract<T = unknown>(opts: {
  contractId: string;
  method: string;
  args: ScArg[];
  source?: string;
}): Promise<T> {
  const account = new Account(opts.source ?? READ_SOURCE, "0");
  const contract = new Contract(opts.contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(opts.method, ...opts.args))
    .setTimeout(30)
    .build();

  const sim = await sorobanRpc.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  if (!("result" in sim) || !sim.result?.retval) {
    throw new Error("no return value from contract");
  }
  return scValToNative(sim.result.retval) as T;
}

export function xlmToStroops(xlm: string): bigint {
  const [whole, frac = ""] = xlm.split(".");
  const padded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * 10_000_000n + BigInt(padded || "0");
}

export function stroopsToXlm(stroops: bigint | number): string {
  const n = typeof stroops === "bigint" ? Number(stroops) : stroops;
  return (n / 1e7).toFixed(4).replace(/\.?0+$/, "");
}
