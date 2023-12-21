import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  Account,
  Account__factory,
  NFT,
  NFT__factory,
} from "../../typechain-types";

describe("Account", () => {
  let runner: HardhatEthersSigner;
  let accountOwner: HardhatEthersSigner;
  let dummyModule1: HardhatEthersSigner;
  let dummyModule2: HardhatEthersSigner;
  let nftMinter: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let account: Account;
  let accountAddress: string;

  before(async () => {
    [runner, accountOwner, dummyModule1, dummyModule2, nftMinter, other] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    const accountFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/Account.sol:Account"
    )) as Account__factory;
    account = await accountFactory.deploy(accountOwner.address, [
      dummyModule1.address,
    ]);
    await account.waitForDeployment();
    accountAddress = await account.getAddress();
  });

  it("initial state", async () => {
    expect(await account.owner()).to.equal(accountOwner.address);
    expect(await account.isModuleAuthorized(dummyModule1.address)).to.be.true;
    expect(await account.isModuleAuthorized(dummyModule2.address)).to.be.false;
  });

  describe("authorizeModule, unauthorizedModule", () => {
    it("failure: UnauthorizedModule", async () => {
      {
        await expect(
          account.connect(dummyModule2).authorizeModule(dummyModule2.address)
        )
          .to.be.revertedWithCustomError(account, "UnauthorizedModule")
          .withArgs(dummyModule2.address);
      }
      {
        await expect(
          account.connect(dummyModule2).unauthorizeModule(dummyModule1.address)
        )
          .to.be.revertedWithCustomError(account, "UnauthorizedModule")
          .withArgs(dummyModule2.address);
      }
    });

    it("success", async () => {
      {
        await expect(
          account.connect(dummyModule1).authorizeModule(dummyModule2.address)
        )
          .to.emit(account, "ModuleAuthorized")
          .withArgs(dummyModule2.address);

        expect(await account.isModuleAuthorized(dummyModule2.address)).to.be
          .true;
      }
      {
        await expect(
          account.connect(dummyModule2).unauthorizeModule(dummyModule1.address)
        )
          .to.emit(account, "ModuleUnauthorized")
          .withArgs(dummyModule1.address);

        expect(await account.isModuleAuthorized(dummyModule1.address)).to.be
          .false;
      }
    });
  });

  describe("execute", () => {
    let nft: NFT;
    let nftAddress: string;

    beforeEach(async () => {
      {
        const nftFactory = (await ethers.getContractFactory(
          "contracts/nft-locker/NFT.sol:NFT"
        )) as NFT__factory;
        nft = await nftFactory.deploy(nftMinter.address);
        await nft.waitForDeployment();
        nftAddress = await nft.getAddress();
      }

      await nft.connect(nftMinter).safeAirdrop(accountAddress, "");
    });

    it("failure: UnauthorizedModule", async () => {
      const toAddress = nftAddress;
      const value = 0;
      const data = nft.interface.encodeFunctionData("approve", [
        other.address,
        0,
      ]);

      await expect(
        account.connect(dummyModule2).execute(toAddress, value, data)
      )
        .to.be.revertedWithCustomError(account, "UnauthorizedModule")
        .withArgs(dummyModule2.address);
    });

    it("success", async () => {
      const toAddress = nftAddress;
      const value = 0;
      const data = nft.interface.encodeFunctionData("approve", [
        other.address,
        0,
      ]);

      await expect(
        account.connect(dummyModule1).execute(toAddress, value, data)
      )
        .to.emit(account, "Executed")
        .withArgs(dummyModule1.address, toAddress, value, data)
        .to.emit(nft, "Approval")
        .withArgs(accountAddress, other.address, 0);

      expect(await nft.getApproved(0)).to.equal(other.address);
    });
  });
});
