import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { MinimalNFT, MinimalNFT__factory } from "../typechain-types";

describe("MinimalNFT", () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;

  let minimalNFTFactory: MinimalNFT__factory;
  let minimalNFT: MinimalNFT;

  before(async () => {
    [runner, minter] = await ethers.getSigners();
  });

  beforeEach(async () => {
    minimalNFTFactory = await ethers.getContractFactory("MinimalNFT");
    minimalNFT = await minimalNFTFactory.deploy();
    await minimalNFT.waitForDeployment();
  });

  describe("mint", () => {
    it("success", async () => {
      await expect(minimalNFT.connect(minter).mint(""))
        .to.emit(minimalNFT, "Transfer")
        .withArgs(ethers.ZeroAddress, minter.address, 0);

      expect(await minimalNFT.balanceOf(minter.address)).to.equal(1);
      expect(await minimalNFT.ownerOf(0)).to.equal(minter.address);
    });
  });
});
