import { ethers } from "hardhat";

import { BigNumberish, Block, BytesLike } from "ethers";

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

export async function getOperationHash(
  relayerModuleAddress: string,
  accountAddress: string,
  nonce: BigNumberish,
  toAddress: string,
  value: BigNumberish,
  data: BytesLike
): Promise<string> {
  const network = await ethers.provider.getNetwork();

  const opData = new ethers.Interface([
    "function execute(address,uint256,bytes)",
  ]).encodeFunctionData("execute", [toAddress, value, data]);

  return ethers.solidityPackedKeccak256(
    ["bytes1", "bytes1", "uint256", "address", "address", "uint256", "bytes"],
    [
      "0x19",
      "0x00",
      network.chainId,
      relayerModuleAddress,
      accountAddress,
      nonce,
      opData,
    ]
  );
}
