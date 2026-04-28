"use client";

import { useMutation } from "@tanstack/react-query";
import { networkPassphrase } from "@/lib/stellar";
import {
  invokeContract,
  addrArg,
  i128Arg,
  u32Arg,
  xlmToStroops,
} from "@/lib/soroban";
import { StellarWalletsKit } from "@/lib/wallets";

type Input = { pollId: number; optionIdx: number; stake: string };
type Output = { hash: string };

export function useSendTx(address: string | null) {
  return useMutation({
    mutationFn: async (input: Input): Promise<Output> => {
      if (!address) throw new Error("connect a wallet first");

      const contractId = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
      if (!contractId) {
        throw new Error("NEXT_PUBLIC_MAIN_CONTRACT_ID is not set");
      }

      const sign = async (xdr: string) => {
        const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
          address,
          networkPassphrase,
        });
        return signedTxXdr;
      };

      const stroops = xlmToStroops(input.stake);
      const result = await invokeContract({
        contractId,
        method: "cast_vote",
        args: [
          addrArg(address),
          u32Arg(input.pollId),
          u32Arg(input.optionIdx),
          i128Arg(stroops),
        ],
        source: address,
        signXdr: sign,
      });
      return { hash: result.hash };
    },
  });
}
