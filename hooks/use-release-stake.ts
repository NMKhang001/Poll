"use client";

import { useMutation } from "@tanstack/react-query";
import { networkPassphrase } from "@/lib/stellar";
import { invokeContract, addrArg, u32Arg } from "@/lib/soroban";
import { StellarWalletsKit } from "@/lib/wallets";

export function useReleaseStake(address: string | null) {
  return useMutation({
    mutationFn: async (pollId: number): Promise<{ hash: string }> => {
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
        method: "release_stake",
        args: [addrArg(address), u32Arg(pollId)],
        source: address,
        signXdr: sign,
      });
      return { hash: result.hash };
    },
  });
}
