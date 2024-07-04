import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  Account,
  RelayerModule,
  NFTReceiverModule,
  NFT,
} from "../typechain-types/contracts";
import {
  Account__factory,
  RelayerModule__factory,
  NFTReceiverModule__factory,
  NFT__factory,
} from "../typechain-types/factories/contracts";

import * as utils from "./utils";

describe("NFTReceiverModule", () => {
  let runner: HardhatEthersSigner;
  let dummyModule: HardhatEthersSigner;
  let accountOwner: HardhatEthersSigner;
  let nftMinter: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let accountFactory: Account__factory;
  let account: Account;
  let accountAddress: string;

  let relayerModuleFactory: RelayerModule__factory;
  let relayerModule: RelayerModule;
  let relayerModuleAddress: string;

  let nftReceiverModuleFactory: NFTReceiverModule__factory;
  let nftReceiverModule: NFTReceiverModule;
  let nftReceiverModuleAddress: string;

  let nftFactory: NFT__factory;
  let nft: NFT;
  let nftAddress: string;

  before(async () => {
    [runner, dummyModule, accountOwner, nftMinter, other] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    {
      accountFactory = await ethers.getContractFactory("Account");

      account = await accountFactory.deploy(accountOwner.address, [
        dummyModule.address,
      ]);
      await account.waitForDeployment();

      accountAddress = await account.getAddress();
    }
    {
      relayerModuleFactory = await ethers.getContractFactory("RelayerModule");

      relayerModule = await relayerModuleFactory.deploy();
      await relayerModule.waitForDeployment();

      relayerModuleAddress = await relayerModule.getAddress();

      await account.connect(dummyModule).authorizeModule(relayerModuleAddress);
    }
    {
      nftReceiverModuleFactory = await ethers.getContractFactory(
        "NFTReceiverModule"
      );

      nftReceiverModule = await nftReceiverModuleFactory.deploy(
        accountAddress,
        relayerModuleAddress
      );
      await nftReceiverModule.waitForDeployment();

      nftReceiverModuleAddress = await nftReceiverModule.getAddress();

      await account
        .connect(dummyModule)
        .authorizeModule(nftReceiverModuleAddress);
    }
    {
      nftFactory = await ethers.getContractFactory("NFT");

      nft = await nftFactory.deploy(nftMinter.address);
      await nft.waitForDeployment();

      nftAddress = await nft.getAddress();
    }
  });

  it("initial state", async () => {
    {
      expect(await nftReceiverModule.owner()).to.equal(accountAddress);
      expect(await nftReceiverModule.nftLocker()).to.equal(
        relayerModuleAddress
      );
    }
  });

  describe("onERC721Received", () => {
    it("failure: OperatorApprovalExists", async () => {
      await account
        .connect(dummyModule)
        .execute(
          nftAddress,
          0,
          nft.interface.encodeFunctionData("setApprovalForAll", [
            other.address,
            true,
          ])
        );

      {
        await expect(
          nft.connect(nftMinter).safeAirdrop(nftReceiverModuleAddress, "", "0x")
        )
          .to.be.revertedWithCustomError(
            nftReceiverModule,
            "OperatorApprovalExists"
          )
          .withArgs(1);
      }
    });

    it("success", async () => {
      {
        const nftLockDuration = 60;

        const txResp = await nft
          .connect(nftMinter)
          .safeAirdrop(
            nftReceiverModuleAddress,
            "",
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256"],
              [nftLockDuration]
            )
          );

        const now = await utils.now();
        const nftLockExpireAt = now + nftLockDuration;

        expect(txResp)
          .to.emit(account, "Executed")
          .withArgs(
            nftReceiverModuleAddress,
            relayerModuleAddress,
            0,
            relayerModule.interface.encodeFunctionData("lockNFT", [
              nftAddress,
              nftLockExpireAt,
            ])
          )
          .to.emit(relayerModule, "NFTLocked")
          .withArgs(accountAddress, nftAddress, nftLockExpireAt)
          .to.emit(nft, "Transfer")
          .withArgs(ethers.ZeroAddress, nftReceiverModuleAddress, 0)
          .to.emit(nft, "Transfer")
          .withArgs(nftReceiverModuleAddress, accountAddress, 0);

        expect(
          await relayerModule.getNFTLockExpireAt(accountAddress, nftAddress)
        ).to.equal(nftLockExpireAt);
        expect(await nft.balanceOf(accountAddress)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(accountAddress);
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
    });
  });
});
