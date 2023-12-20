import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { NFT } from "../../typechain-types";

describe("NFT", () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;

  let nft: NFT;

  before(async () => {
    [runner, minter] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const nftFactory = await ethers.getContractFactory(
      "contracts/erc721-locker/NFT.sol:NFT"
    );
    nft = await nftFactory.deploy();
    await nft.waitForDeployment();
  });

  describe("mint", () => {
    it("success", async () => {
      await expect(nft.connect(minter).mint(""))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, minter.address, 0);

      expect(await nft.balanceOf(minter.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(minter.address);
    });
  });
});
