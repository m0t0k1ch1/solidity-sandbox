import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  RelayerModule,
  RelayerModule__factory,
  NFTReceiverModule,
  NFTReceiverModule__factory,
  Account,
  Account__factory,
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
  });

  it("initial state", async () => {
    expect(await nftReceiverModule.owner()).to.equal(accountAddress);
    expect(await nftReceiverModule.nftLocker()).to.equal(relayerModuleAddress);
  });

  describe("setNFTLocker", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        nftReceiverModule.setNFTLocker(dummyModule.address)
      ).to.be.revertedWithCustomError(
        nftReceiverModule,
        "OwnableUnauthorizedAccount"
      );
    });

    it("success", async () => {
      const data = nftReceiverModule.interface.encodeFunctionData(
        "setNFTLocker",
        [dummyModule.address]
      );

      await expect(
        account.connect(dummyModule).execute(nftReceiverModuleAddress, 0, data)
      )
        .to.emit(account, "Executed")
        .withArgs(dummyModule.address, nftReceiverModuleAddress, 0, data);

      expect(await nftReceiverModule.nftLocker()).to.equal(dummyModule.address);
    });
  });

  describe("onERC721Received", () => {
    let nft: NFT;
    let nftAddress: string;

    beforeEach(async () => {
      const nftFactory = (await ethers.getContractFactory(
        "contracts/nft-locker/NFT.sol:NFT"
      )) as NFT__factory;
      nft = await nftFactory.deploy(nftMinter.address);
      await nft.waitForDeployment();
      nftAddress = await nft.getAddress();
    });

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
          nft.connect(nftMinter).safeAirdrop(nftReceiverModuleAddress, "")
        )
          .to.be.revertedWithCustomError(
            nftReceiverModule,
            "OperatorApprovalExists"
          )
          .withArgs(1);
      }
    });

    it("success", async () => {
      await expect(
        nft.connect(nftMinter).safeAirdrop(nftReceiverModuleAddress, "")
      )
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, nftReceiverModuleAddress, 0)
        .to.emit(nft, "Transfer")
        .withArgs(nftReceiverModuleAddress, accountAddress, 0);

      expect(await nft.balanceOf(accountAddress)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(accountAddress);
    });
  });
});
