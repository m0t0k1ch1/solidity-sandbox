import { ethers } from "hardhat";

import { BigNumberish, BytesLike } from "ethers";

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
