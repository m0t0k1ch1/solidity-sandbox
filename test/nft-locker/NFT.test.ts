import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { NFT } from "../../typechain-types/contracts/nft-locker";
import { NFT__factory } from "../../typechain-types/factories/contracts/nft-locker";

describe("NFT", () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;
  let operator1: HardhatEthersSigner;
  let operator2: HardhatEthersSigner;
  let operator3: HardhatEthersSigner;

  let nftFactory: NFT__factory;
  let nft: NFT;
  let nftAddress: string;

  before(async () => {
    [runner, minter, receiver, operator1, operator2, operator3] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    {
      nftFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/NFT.sol:NFT"
      )) as NFT__factory;

      nft = await nftFactory.deploy(minter.address);
      await nft.waitForDeployment();

      nftAddress = await nft.getAddress();
    }
  });

  it("initial state", async () => {
    {
      expect(await nft.minter()).to.equal(minter.address);
      expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(0);
    }
  });

  describe("safeAirdrop", () => {
    it("success", async () => {
      {
        await expect(
          nft.connect(minter).safeAirdrop(receiver.address, "", "0x")
        )
          .to.emit(nft, "Transfer")
          .withArgs(ethers.ZeroAddress, receiver.address, 0);

        expect(await nft.balanceOf(receiver.address)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(receiver.address);
      }
    });
  });

  describe("setApprovalForAll", () => {
    it("success", async () => {
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator1.address, true)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator1.address, true);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(1);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator1.address, true)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator1.address, true);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(1);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator2.address, true)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator2.address, true);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(2);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator3.address, true)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator3.address, true);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(3);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator1.address, false)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator1.address, false);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(2);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator1.address, false)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator1.address, false);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(2);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator2.address, false)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator2.address, false);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(1);
      }
      {
        await expect(
          nft.connect(receiver).setApprovalForAll(operator3.address, false)
        )
          .to.emit(nft, "ApprovalForAll")
          .withArgs(receiver.address, operator3.address, false);

        expect(await nft.operatorApprovalCountOf(receiver.address)).to.equal(0);
      }
    });
  });
});
