import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import * as utils from "./utils";

import {
  Account,
  Account__factory,
  RelayerModule,
  RelayerModule__factory,
  NFT,
  NFT__factory,
} from "../../typechain-types";

describe("RelayerModule", () => {
  let runner: HardhatEthersSigner;
  let accountOwner: HardhatEthersSigner;
  let dummyModule: HardhatEthersSigner;
  let nftMinter: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let account: Account;
  let accountAddress: string;

  let relayerModule: RelayerModule;
  let relayerModuleAddress: string;

  before(async () => {
    [runner, accountOwner, dummyModule, nftMinter, other] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    {
      const accountFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/Account.sol:Account"
      )) as Account__factory;
      account = await accountFactory.deploy(accountOwner.address, [
        dummyModule.address,
      ]);
      await account.waitForDeployment();
      accountAddress = await account.getAddress();
    }
    {
      const relayerModuleFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/RelayerModule.sol:RelayerModule"
      )) as RelayerModule__factory;
      relayerModule = await relayerModuleFactory.deploy();
      await relayerModule.waitForDeployment();
      relayerModuleAddress = await relayerModule.getAddress();

      await account.connect(dummyModule).authorizeModule(relayerModuleAddress);
    }
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

    it("failure: InvalidSignature", async () => {
      const nonce = await relayerModule.nonceOf(accountAddress);
      const toAddress = nftAddress;
      const value = 0;
      const data = nft.interface.encodeFunctionData("approve", [
        other.address,
        0,
      ]);

      const opHash = await utils.getOperationHash(
        relayerModuleAddress,
        accountAddress,
        nonce,
        toAddress,
        value,
        data
      );

      const sig = await other.signMessage(ethers.getBytes(opHash));

      await expect(
        relayerModule.execute(accountAddress, toAddress, value, data, sig)
      ).to.be.revertedWithCustomError(relayerModule, "InvalidSignature");
    });

    it("failure: InvalidOperation", async () => {
      {
        const nftLockExpireAt = (await utils.now()) + 60;
        const data = relayerModule.interface.encodeFunctionData("lockNFT", [
          nftAddress,
          nftLockExpireAt,
        ]);

        await expect(
          account.connect(dummyModule).execute(relayerModuleAddress, 0, data)
        )
          .to.emit(account, "Executed")
          .withArgs(dummyModule.address, relayerModuleAddress, 0, data)
          .to.emit(relayerModule, "NFTLocked")
          .withArgs(accountAddress, nftAddress, nftLockExpireAt);

        expect(
          await relayerModule.getNFTLockExpireAt(accountAddress, nftAddress)
        ).to.equal(nftLockExpireAt);
      }
      {
        const nonce = await relayerModule.nonceOf(accountAddress);
        const toAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData("approve", [
          other.address,
          0,
        ]);

        const opHash = await utils.getOperationHash(
          relayerModuleAddress,
          accountAddress,
          nonce,
          toAddress,
          value,
          data
        );

        const sig = await accountOwner.signMessage(ethers.getBytes(opHash));

        await expect(
          relayerModule.execute(accountAddress, toAddress, value, data, sig)
        ).to.be.revertedWithCustomError(relayerModule, "InvalidOperation");
      }
    });

    it("success", async () => {
      const nonce = await relayerModule.nonceOf(accountAddress);
      const toAddress = nftAddress;
      const value = 0;
      const data = nft.interface.encodeFunctionData("approve", [
        other.address,
        0,
      ]);

      const opHash = await utils.getOperationHash(
        relayerModuleAddress,
        accountAddress,
        nonce,
        toAddress,
        value,
        data
      );

      const sig = await accountOwner.signMessage(ethers.getBytes(opHash));

      await expect(
        relayerModule.execute(accountAddress, toAddress, value, data, sig)
      )
        .to.emit(relayerModule, "Executed")
        .withArgs(accountAddress, opHash, true, anyValue)
        .to.emit(nft, "Approval")
        .withArgs(accountAddress, other.address, 0);

      expect(await nft.getApproved(0)).to.be.equal(other.address);
    });
  });
});
