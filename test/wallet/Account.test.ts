import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { Account } from "../../typechain-types/contracts/wallet";
import { Account__factory } from "../../typechain-types/factories/contracts/wallet";

describe("Account", () => {
  let runner: HardhatEthersSigner;

  let account: Account;

  before(async () => {
    [runner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const accountFactory = (await ethers.getContractFactory(
      "contracts/wallet/Account.sol:Account"
    )) as Account__factory;
    account = await accountFactory.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );
    await account.waitForDeployment();
  });

  it("initial state", async () => {
    expect(await account.owner()).to.equal(ethers.ZeroAddress);
    expect(await account.entryPoint()).to.equal(ethers.ZeroAddress);
  });
});
