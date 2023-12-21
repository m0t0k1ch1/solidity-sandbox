import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  NFT,
  NFT__factory,
  NFTReceiverModule,
  NFTReceiverModule__factory,
} from "../../typechain-types";

describe("NFTReceiver", () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;
  let operator: HardhatEthersSigner;

  let nft: NFT;
  let nftReceiverModule: NFTReceiverModule;

  before(async () => {
    [runner, minter, receiver, operator] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const nftFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/NFT.sol:NFT"
    )) as NFT__factory;
    nft = await nftFactory.deploy(minter.address);
    await nft.waitForDeployment();

    const nftReceiverModuleFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/NFTReceiverModule.sol:NFTReceiverModule"
    )) as NFTReceiverModule__factory;
    nftReceiverModule = await nftReceiverModuleFactory.deploy(receiver.address);
    await nftReceiverModule.waitForDeployment();
  });

  describe("onERC721Received", () => {
    it("failure: OperatorApprovalExists", async () => {
      const nftReceiverModuleAddress = await nftReceiverModule.getAddress();

      await nft.connect(receiver).setApprovalForAll(operator.address, true);

      await expect(
        nft.connect(minter).safeAirdrop(nftReceiverModuleAddress, "")
      )
        .to.be.revertedWithCustomError(
          nftReceiverModule,
          "OperatorApprovalExists"
        )
        .withArgs(1);
    });

    it("success", async () => {
      const nftReceiverModuleAddress = await nftReceiverModule.getAddress();

      await expect(
        nft.connect(minter).safeAirdrop(nftReceiverModuleAddress, "")
      )
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, nftReceiverModuleAddress, 0)
        .to.emit(nft, "Transfer")
        .withArgs(nftReceiverModuleAddress, receiver.address, 0);

      expect(await nft.balanceOf(receiver.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(receiver.address);
    });
  });
});
