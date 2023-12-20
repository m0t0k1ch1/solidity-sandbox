import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  NFT,
  NFT__factory,
  NFTLocker,
  NFTLocker__factory,
} from "../../typechain-types";

describe("NFTLocker", () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;

  let nft: NFT;
  let nftLocker: NFTLocker;

  before(async () => {
    [runner, minter, receiver] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const nftFactory = (await ethers.getContractFactory(
      "contracts/erc721-locker/NFT.sol:NFT"
    )) as NFT__factory;
    nft = await nftFactory.deploy(minter.address);
    await nft.waitForDeployment();

    const nftLockerFactory = (await ethers.getContractFactory(
      "contracts/erc721-locker/NFTLocker.sol:NFTLocker"
    )) as NFTLocker__factory;
    nftLocker = await nftLockerFactory.deploy(receiver.address);
    await nftLocker.waitForDeployment();
  });

  describe("onERC721Received", () => {
    it("success", async () => {
      const nftLockerAddress = await nftLocker.getAddress();

      await expect(nft.connect(minter).safeAirdrop(nftLockerAddress, ""))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, nftLockerAddress, 0)
        .to.emit(nft, "Transfer")
        .withArgs(nftLockerAddress, receiver.address, 0);

      expect(await nft.balanceOf(receiver.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(receiver.address);
    });
  });
});
