"use client";

import { useMutation } from "@tanstack/react-query";
import { networkPassphrase } from "@/lib/stellar";
import {
  invokeContract,
  addrArg,
  strArg,
  u64Arg,
  vecStrArg,
} from "@/lib/soroban";
import { StellarWalletsKit } from "@/lib/wallets";

type Input = {
  question: string;
  options: string[];
  windowSecs: number;
};

export function useCreatePoll(address: string | null) {
  return useMutation({
    mutationFn: async (input: Input): Promise<{ hash: string }> => {
      if (!address) throw new Error("connect a wallet first");
      const contractId = process.env.NEXT_PUBLIC_MAIN_CONTRACT_ID;
      if (!contractId) throw new Error("NEXT_PUBLIC_MAIN_CONTRACT_ID is not set");

      const sign = async (xdr: string) => {
        const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
          address,
          networkPassphrase,
        });
        return signedTxXdr;
      };

      const result = await invokeContract({
        contractId,
        method: "create_poll",
        args: [
          addrArg(address),
          strArg(input.question),
          vecStrArg(input.options),
          u64Arg(input.windowSecs),
        ],
        source: address,
        signXdr: sign,
      });
      return { hash: result.hash };
    },
  });
}
