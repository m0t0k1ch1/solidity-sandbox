import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { Plugin } from "../../typechain-types/contracts/wallet";
import { Plugin__factory } from "../../typechain-types/factories/contracts/wallet";

import * as utils from "./utils";

describe("wallet/Plugin", () => {
  let runner: HardhatEthersSigner;
  let account1: HardhatEthersSigner;
  let account2: HardhatEthersSigner;

  let pluginFactory: Plugin__factory;
  let plugin: Plugin;
  let pluginAddress: string;

  before(async () => {
    [runner, account1, account2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    {
      pluginFactory = (await ethers.getContractFactory(
        "contracts/wallet/Plugin.sol:Plugin"
      )) as Plugin__factory;

      plugin = await pluginFactory.deploy();
      await plugin.waitForDeployment();

      pluginAddress = await plugin.getAddress();
    }
  });

  describe("setGuard", () => {
    it("success", async () => {
      {
        await expect(
          plugin
            .connect(account1)
            .setGuard(utils.ZERO_ADDRESS, ethers.MaxUint256)
        )
          .to.emit(plugin, "GuardSet")
          .withArgs(account1.address, utils.ZERO_ADDRESS, ethers.MaxUint256);

        expect(
          await plugin
            .connect(account1)
            .getGuardExpireAt(account1.address, utils.ZERO_ADDRESS)
        ).to.equal(ethers.MaxUint256);
      }
    });
  });

  describe("onUninstall", () => {
    it("success", async () => {
      await plugin
        .connect(account1)
        .setGuard(utils.ZERO_ADDRESS, ethers.MaxUint256);

      await plugin
        .connect(account1)
        .setGuard(utils.ONE_ADDRESS, ethers.MaxUint256);

      await plugin
        .connect(account2)
        .setGuard(utils.ZERO_ADDRESS, ethers.MaxUint256);

      {
        await plugin.connect(account1).onUninstall("0x");

        expect(
          await plugin.getGuardExpireAt(account1.address, utils.ZERO_ADDRESS)
        ).to.equal(0);
        expect(
          await plugin.getGuardExpireAt(account1.address, utils.ONE_ADDRESS)
        ).to.equal(0);
        expect(
          await plugin.getGuardExpireAt(account2.address, utils.ZERO_ADDRESS)
        ).to.equal(ethers.MaxUint256);
      }
    });
  });
});
