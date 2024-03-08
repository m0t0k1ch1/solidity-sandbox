import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { Account, Plugin } from "../../typechain-types/contracts/wallet";
import {
  Account__factory,
  NFT__factory,
  Plugin__factory,
  Proxy__factory,
} from "../../typechain-types/factories/contracts/wallet";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

describe("Account", () => {
  let runner: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let proxyFactory: Proxy__factory;

  let accountFactory: Account__factory;
  let account: Account;
  let accountAddress: string;

  let pluginFactory: Plugin__factory;
  let plugin: Plugin;
  let pluginAddress: string;

  let nftFactory: NFT__factory;

  before(async () => {
    [runner, owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    {
      proxyFactory = (await ethers.getContractFactory(
        "contracts/wallet/Proxy.sol:Proxy"
      )) as Proxy__factory;
    }
    {
      accountFactory = (await ethers.getContractFactory(
        "contracts/wallet/Account.sol:Account"
      )) as Account__factory;

      const impl = await accountFactory.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
      );
      await impl.waitForDeployment();

      const proxy = await proxyFactory.deploy(await impl.getAddress(), "0x");
      await proxy.waitForDeployment();

      accountAddress = await proxy.getAddress();
      account = accountFactory.attach(accountAddress) as Account;

      await account.initialize(owner.address, ethers.ZeroAddress);
    }
    {
      pluginFactory = (await ethers.getContractFactory(
        "contracts/wallet/Plugin.sol:Plugin"
      )) as Plugin__factory;

      plugin = await pluginFactory.deploy();
      await plugin.waitForDeployment();

      pluginAddress = await plugin.getAddress();
    }
    {
      nftFactory = (await ethers.getContractFactory(
        "contracts/wallet/NFT.sol:NFT"
      )) as NFT__factory;
    }
  });

  it("initial state", async () => {
    expect(await account.owner()).to.equal(owner.address);
    expect(await account.entryPoint()).to.equal(ethers.ZeroAddress);
    expect(await account.plugin()).to.equal(ethers.ZeroAddress);
  });

  describe("initialize", () => {
    it("failure: InvalidInitialization", async () => {
      {
        await expect(
          account.connect(owner).initialize(owner.address, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(account, "InvalidInitialization");
      }
    });
  });

  describe("upgradeToAndCall", () => {
    it("failure: UnauthorizedCaller", async () => {
      {
        await expect(
          account.connect(owner).upgradeToAndCall(accountAddress, "0x")
        )
          .to.be.revertedWithCustomError(account, "UnauthorizedCaller")
          .withArgs(owner.address);
      }
    });

    it("success", async () => {
      {
        const newImpl = await accountFactory.deploy(
          ethers.ZeroAddress,
          ethers.ZeroAddress
        );
        await newImpl.waitForDeployment();

        const newImplAddress = await newImpl.getAddress();

        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("upgradeToAndCall", [
          newImplAddress,
          "0x",
        ]);

        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.emit(account, "Upgraded")
          .withArgs(newImplAddress);
      }
    });
  });

  describe("installPlugin, uninstallPlugin", () => {
    it("all", async () => {
      {
        // installPlugin: failure: UnauthorizedCaller
        await expect(account.connect(owner).installPlugin(pluginAddress, "0x"))
          .to.be.revertedWithCustomError(account, "UnauthorizedCaller")
          .withArgs(owner.address);
      }
      {
        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("installPlugin", [
          ethers.ZeroAddress,
          "0x",
        ]);

        // installPlugin: failure: PluginInterfaceNotSupported
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.be.revertedWithCustomError(account, "PluginInterfaceNotSupported")
          .withArgs(ethers.ZeroAddress);
      }
      {
        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("installPlugin", [
          pluginAddress,
          "0x",
        ]);

        // installPlugin: success
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.emit(account, "PluginInstalled")
          .withArgs(pluginAddress);

        expect(await account.plugin()).to.equal(pluginAddress);
      }
      {
        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("installPlugin", [
          pluginAddress,
          "0x",
        ]);

        // installPlugin: failure: PluginAlreadyInstalled
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.be.revertedWithCustomError(account, "PluginAlreadyInstalled")
          .withArgs(pluginAddress);
      }
      {
        // uninstallPlugin: failure: UnauthorizedCaller
        await expect(account.connect(owner).uninstallPlugin("0x"))
          .to.be.revertedWithCustomError(account, "UnauthorizedCaller")
          .withArgs(owner.address);
      }
      {
        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("uninstallPlugin", [
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["address"],
            [accountAddress]
          ),
        ]);

        // uninstallPlugin: success
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.emit(account, "PluginUninstalled")
          .withArgs(pluginAddress);

        expect(await account.plugin()).to.equal(ethers.ZeroAddress);
      }
      {
        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("uninstallPlugin", [
          "0x",
        ]);

        // uninstallPlugin: failure: PluginAlreadyUninstalled
        await expect(
          account.connect(owner).execute(targetAddress, value, data)
        ).to.be.revertedWithCustomError(account, "PluginAlreadyUninstalled");
      }
    });
  });

  describe("execute", () => {
    it("block NFT transfer", async () => {
      const nft = await nftFactory.deploy();
      await nft.waitForDeployment();

      const nftAddress = await nft.getAddress();

      const guardDuration = 60;

      {
        const targetAddress = accountAddress;
        const value = 0;
        const data = account.interface.encodeFunctionData("installPlugin", [
          pluginAddress,
          "0x",
        ]);

        // success: installPlugin
        await account.connect(owner).execute(targetAddress, value, data);
      }
      {
        const targetAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData("mint", [""]);

        // execute(mint): success
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.emit(nft, "Transfer")
          .withArgs(ethers.ZeroAddress, accountAddress, 0);

        expect(await nft.balanceOf(accountAddress)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(accountAddress);
      }
      {
        const guardExpireAt = (await utils.now()) + guardDuration;

        const targetAddress = pluginAddress;
        const value = 0;
        const data = plugin.interface.encodeFunctionData("setGuard", [
          nftAddress,
          guardExpireAt,
        ]);

        // setGuard: success
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.emit(plugin, "GuardSet")
          .withArgs(accountAddress, nftAddress, guardExpireAt);

        expect(
          await plugin.getGuardExpireAt(accountAddress, nftAddress)
        ).to.equal(guardExpireAt);
      }
      {
        const targetAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData(
          "safeTransferFrom(address,address,uint256)",
          [accountAddress, other.address, 0]
        );

        // execute(safeTransferFrom): failure: Guarded
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.be.revertedWithCustomError(plugin, "Guarded")
          .withArgs(accountAddress, nftAddress);
      }

      await helpers.time.increase(guardDuration);

      {
        const targetAddress = nftAddress;
        const value = 0;
        const data = nft.interface.encodeFunctionData(
          "safeTransferFrom(address,address,uint256)",
          [accountAddress, other.address, 0]
        );

        // execute(safeTransferFrom): success
        await expect(account.connect(owner).execute(targetAddress, value, data))
          .to.emit(nft, "Transfer")
          .withArgs(accountAddress, other.address, 0);

        expect(await nft.balanceOf(accountAddress)).to.equal(0);
        expect(await nft.balanceOf(other.address)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(other.address);
      }
    });
  });
});
