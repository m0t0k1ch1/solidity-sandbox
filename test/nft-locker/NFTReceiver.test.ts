import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  NFT,
  NFT__factory,
  NFTReceiver,
  NFTReceiver__factory,
} from "../../typechain-types";

describe("NFTReceiver", () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;

  let nft: NFT;
  let nftReceiver: NFTReceiver;

  before(async () => {
    [runner, minter, receiver] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const nftFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/NFT.sol:NFT"
    )) as NFT__factory;
    nft = await nftFactory.deploy(minter.address);
    await nft.waitForDeployment();

    const nftReceiverFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/NFTReceiver.sol:NFTReceiver"
    )) as NFTReceiver__factory;
    nftReceiver = await nftReceiverFactory.deploy(receiver.address);
    await nftReceiver.waitForDeployment();
  });

  describe("onERC721Received", () => {
    it("success", async () => {
      const nftReceiverAddress = await nftReceiver.getAddress();

      await expect(nft.connect(minter).safeAirdrop(nftReceiverAddress, ""))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, nftReceiverAddress, 0)
        .to.emit(nft, "Transfer")
        .withArgs(nftReceiverAddress, receiver.address, 0);

      expect(await nft.balanceOf(receiver.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(receiver.address);
    });
  });
});
