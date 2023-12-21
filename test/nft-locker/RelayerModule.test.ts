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
  let owner: HardhatEthersSigner;
  let dummyModule: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let account: Account;
  let relayerModule: RelayerModule;

  before(async () => {
    [runner, owner, dummyModule, minter, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const relayerModuleFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/RelayerModule.sol:RelayerModule"
    )) as RelayerModule__factory;
    relayerModule = await relayerModuleFactory.deploy();
    await relayerModule.waitForDeployment();

    const accountFactory = (await ethers.getContractFactory(
      "contracts/nft-locker/Account.sol:Account"
    )) as Account__factory;
    account = await accountFactory.deploy(owner.address, [
      await relayerModule.getAddress(),
      dummyModule.address,
    ]);
    await account.waitForDeployment();
  });

  describe("execute", () => {
    let nft: NFT;

    beforeEach(async () => {
      const nftFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/NFT.sol:NFT"
      )) as NFT__factory;
      nft = await nftFactory.deploy(minter.address);
      await nft.waitForDeployment();

      await nft.connect(minter).safeAirdrop(await account.getAddress(), "");
    });

    it("failure: InvalidSignature", async () => {
      const relayerModuleAddress = await relayerModule.getAddress();
      const accountAddress = await account.getAddress();

      {
        const nonce = await relayerModule.nonceOf(accountAddress);
        const toAddress = await nft.getAddress();
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
      }
    });

    it("failure: InvalidOperation", async () => {
      const relayerModuleAddress = await relayerModule.getAddress();
      const accountAddress = await account.getAddress();
      const nftAddress = await nft.getAddress();
      const nftLockDuration = 60;

      {
        const nftLockExpireAt = (await utils.now()) + nftLockDuration;
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

        const sig = await owner.signMessage(ethers.getBytes(opHash));

        await expect(
          relayerModule.execute(accountAddress, toAddress, value, data, sig)
        ).to.be.revertedWithCustomError(relayerModule, "InvalidOperation");
      }
    });

    it("success", async () => {
      const relayerModuleAddress = await relayerModule.getAddress();
      const accountAddress = await account.getAddress();

      {
        const nonce = await relayerModule.nonceOf(accountAddress);
        const toAddress = await nft.getAddress();
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

        const sig = await owner.signMessage(ethers.getBytes(opHash));

        await expect(
          relayerModule.execute(accountAddress, toAddress, value, data, sig)
        )
          .to.emit(relayerModule, "Executed")
          .withArgs(accountAddress, opHash, true, anyValue)
          .to.emit(nft, "Approval")
          .withArgs(accountAddress, other.address, 0);

        expect(await nft.getApproved(0)).to.be.equal(other.address);
      }
    });
  });
});
