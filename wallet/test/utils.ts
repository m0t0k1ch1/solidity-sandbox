import { ethers } from "hardhat";

import { Block } from "ethers";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;
export const ONE_ADDRESS =
  "0x0000000000000000000000000000000000000001" as const;

export async function now(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ethers.provider
      .getBlockNumber()
      .then((blockNumber: number) => {
        ethers.provider
          .getBlock(blockNumber)
          .then((block: Block | null) => {
            if (block === null) {
              reject(new Error("block not found"));
              return;
            }
            resolve(block.timestamp);
          })
          .catch((e) => reject(e));
      })
      .catch((e) => reject(e));
  });
}
