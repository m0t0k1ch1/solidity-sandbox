import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

import {
  Account,
  RelayerModule,
  NFT,
} from "../../typechain-types/contracts/nft-locker";
import {
  Account__factory,
  RelayerModule__factory,
  NFT__factory,
} from "../../typechain-types/factories/contracts/nft-locker";

describe("RelayerModule", () => {
  let runner: HardhatEthersSigner;
  let accountOwner: HardhatEthersSigner;
  let dummyModule: HardhatEthersSigner;
  let nftMinter: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let accountFactory: Account__factory;
  let account: Account;
  let accountAddress: string;

  let relayerModuleFactory: RelayerModule__factory;
  let relayerModule: RelayerModule;
  let relayerModuleAddress: string;

  let nftFactory: NFT__factory;
  let nft: NFT;
  let nftAddress: string;

  before(async () => {
    [runner, accountOwner, dummyModule, nftMinter, other] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    {
      accountFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/Account.sol:Account"
      )) as Account__factory;

      account = await accountFactory.deploy(accountOwner.address, [
        dummyModule.address,
      ]);
      await account.waitForDeployment();

      accountAddress = await account.getAddress();
    }
    {
      relayerModuleFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/RelayerModule.sol:RelayerModule"
      )) as RelayerModule__factory;

      relayerModule = await relayerModuleFactory.deploy();
      await relayerModule.waitForDeployment();

      relayerModuleAddress = await relayerModule.getAddress();

      await account.connect(dummyModule).authorizeModule(relayerModuleAddress);
    }
    {
      nftFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/NFT.sol:NFT"
      )) as NFT__factory;

      nft = await nftFactory.deploy(nftMinter.address);
      await nft.waitForDeployment();

      nftAddress = await nft.getAddress();

      await nft.connect(nftMinter).safeAirdrop(accountAddress, "", "0x");
    }
  });

  describe("lockNFT", () => {
    it("success -> failure: NFTAlreadyLocked", async () => {
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
        const data = relayerModule.interface.encodeFunctionData("lockNFT", [
          nftAddress,
          0,
        ]);

        await expect(
          account.connect(dummyModule).execute(relayerModuleAddress, 0, data)
        ).to.be.revertedWithCustomError(relayerModule, "NFTAlreadyLocked");
      }
    });
  });

  describe("execute", () => {
    it("failure: InvalidSignature", async () => {
      {
        const nonce = await relayerModule.nonceOf(accountAddress);
        const toAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData(
          "safeTransferFrom(address,address,uint256)",
          [accountAddress, other.address, 0]
        );

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

    it("failure: InvalidOperation -> success", async () => {
      const nftLockDuration = 60;

      {
        await account
          .connect(dummyModule)
          .execute(
            relayerModuleAddress,
            0,
            relayerModule.interface.encodeFunctionData("lockNFT", [
              nftAddress,
              (await utils.now()) + nftLockDuration,
            ])
          );
      }
      {
        const nonce = await relayerModule.nonceOf(accountAddress);
        const toAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData(
          "safeTransferFrom(address,address,uint256)",
          [accountAddress, other.address, 0]
        );

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

      await helpers.time.increase(nftLockDuration);

      {
        const nonce = await relayerModule.nonceOf(accountAddress);
        const toAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData(
          "safeTransferFrom(address,address,uint256)",
          [accountAddress, other.address, 0]
        );

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
          .to.emit(nft, "Transfer")
          .withArgs(accountAddress, other.address, 0);

        expect(await nft.balanceOf(other.address)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(other.address);
      }
    });
  });
});
