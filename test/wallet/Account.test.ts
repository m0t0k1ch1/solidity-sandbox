import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { Account, Plugin } from "../../typechain-types/contracts/wallet";
import {
  Account__factory,
  Plugin__factory,
  Proxy__factory,
} from "../../typechain-types/factories/contracts/wallet";

describe("Account", () => {
  let runner: HardhatEthersSigner;
  let owner: HardhatEthersSigner;

  let proxyFactory: Proxy__factory;

  let accountFactory: Account__factory;
  let account: Account;
  let accountAddress: string;

  let pluginFactory: Plugin__factory;
  let plugin: Plugin;
  let pluginAddress: string;

  before(async () => {
    [runner, owner] = await ethers.getSigners();
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
  });

  it("initial state", async () => {
    expect(await account.owner()).to.equal(owner.address);
    expect(await account.entryPoint()).to.equal(ethers.ZeroAddress);
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
        const data = account.interface.encodeFunctionData("installPlugin", [
          ethers.ZeroAddress,
          "0x",
        ]);

        // installPlugin: failure: PluginInterfaceNotSupported
        await expect(account.connect(owner).execute(accountAddress, 0, data))
          .to.be.revertedWithCustomError(account, "PluginInterfaceNotSupported")
          .withArgs(ethers.ZeroAddress);
      }
      {
        const data = account.interface.encodeFunctionData("installPlugin", [
          pluginAddress,
          "0x",
        ]);

        // installPlugin: success
        await expect(account.connect(owner).execute(accountAddress, 0, data))
          .to.emit(account, "PluginInstalled")
          .withArgs(pluginAddress);
      }
      {
        const data = account.interface.encodeFunctionData("installPlugin", [
          pluginAddress,
          "0x",
        ]);

        // installPlugin: failure: PluginAlreadyInstalled
        await expect(account.connect(owner).execute(accountAddress, 0, data))
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
        const data = account.interface.encodeFunctionData("uninstallPlugin", [
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["address"],
            [accountAddress]
          ),
        ]);

        // uninstallPlugin: success
        await expect(account.connect(owner).execute(accountAddress, 0, data))
          .to.emit(account, "PluginUninstalled")
          .withArgs(pluginAddress);
      }
      {
        const data = account.interface.encodeFunctionData("uninstallPlugin", [
          "0x",
        ]);

        // uninstallPlugin: failure: PluginAlreadyUninstalled
        await expect(
          account.connect(owner).execute(accountAddress, 0, data)
        ).to.be.revertedWithCustomError(account, "PluginAlreadyUninstalled");
      }
    });
  });
});
