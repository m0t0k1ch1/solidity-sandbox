import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import * as utils from "./utils";

import {
  Account,
  Account__factory,
  RelayerModule,
  RelayerModule__factory,
  NFTReceiverModule,
  NFTReceiverModule__factory,
  NFT,
  NFT__factory,
} from "../../typechain-types";

describe("NFTReceiverModule", () => {
  let runner: HardhatEthersSigner;
  let dummyModule: HardhatEthersSigner;
  let accountOwner: HardhatEthersSigner;
  let nftMinter: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let account: Account;
  let accountAddress: string;

  let relayerModule: RelayerModule;
  let relayerModuleAddress: string;

  let nftReceiverModule: NFTReceiverModule;
  let nftReceiverModuleAddress: string;

  let nft: NFT;
  let nftAddress: string;

  before(async () => {
    [runner, dummyModule, accountOwner, nftMinter, other] =
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
    {
      const nftReceiverModuleFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/NFTReceiverModule.sol:NFTReceiverModule"
      )) as NFTReceiverModule__factory;
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
      const nftFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/NFT.sol:NFT"
      )) as NFT__factory;
      nft = await nftFactory.deploy(nftMinter.address);
      await nft.waitForDeployment();
      nftAddress = await nft.getAddress();
    }
  });

  it("initial state", async () => {
    expect(await nftReceiverModule.owner()).to.equal(accountAddress);
    expect(await nftReceiverModule.nftLocker()).to.equal(relayerModuleAddress);
  });

  describe("onERC721Received", () => {
    it("failure: OperatorApprovalExists", async () => {
      {
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
      }
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
