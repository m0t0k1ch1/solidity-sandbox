import { ethers } from "hardhat";

import { Account, Plugin } from "../../typechain-types/contracts/wallet";
import {
  Account__factory,
  Plugin__factory,
  Proxy__factory,
} from "../../typechain-types/factories/contracts/wallet";

const ENTRY_POINT_ADDRESS =
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;

(async () => {
  const [runner] = await ethers.getSigners();

  const proxyFactory = (await ethers.getContractFactory(
    "contracts/wallet/Proxy.sol:Proxy"
  )) as Proxy__factory;
  const accountFactory = (await ethers.getContractFactory(
    "contracts/wallet/Account.sol:Account"
  )) as Account__factory;
  const pluginFactory = (await ethers.getContractFactory(
    "contracts/wallet/Plugin.sol:Plugin"
  )) as Plugin__factory;

  let account: Account;
  let accountAddress: string;
  {
    const impl = await accountFactory.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );
    await impl.waitForDeployment();

    const implAddress = await impl.getAddress();

    console.log(`Account(impl): deployed to ${implAddress}`);

    const proxy = await proxyFactory.deploy(await impl.getAddress(), "0x");
    await proxy.waitForDeployment();

    accountAddress = await proxy.getAddress();

    console.log(`Account(proxy): deployed to ${accountAddress}`);

    account = accountFactory.attach(accountAddress) as Account;

    await account.initialize(runner.address, ENTRY_POINT_ADDRESS);
  }

  let plugin: Plugin;
  let pluginAddress: string;
  {
    plugin = await pluginFactory.deploy();
    await plugin.waitForDeployment();

    pluginAddress = await plugin.getAddress();

    console.log(`Plugin: deployed to ${pluginAddress}`);
  }

  {
    const targetAddress = accountAddress;
    const value = 0;
    const data = account.interface.encodeFunctionData("installPlugin", [
      pluginAddress,
      "0x",
    ]);

    await account.execute(targetAddress, value, data);

    console.log(`Account(proxy): plugin ${pluginAddress} installed`);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
