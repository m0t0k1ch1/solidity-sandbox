import { ethers } from "hardhat";

import { Account, Plugin } from "../typechain-types/contracts";
import { Proxy__factory } from "../typechain-types/factories/contracts";

const ENTRY_POINT_ADDRESS =
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;

(async () => {
  const [runner] = await ethers.getSigners();

  let account: Account;
  let accountAddress: string;
  {
    const accountFactory = await ethers.getContractFactory("Account");

    const impl = await accountFactory.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );
    await impl.waitForDeployment();

    const implAddress = await impl.getAddress();

    console.log(`Account(impl): deployed to ${implAddress}`);

    const proxyFactory = (await ethers.getContractFactory(
      "contracts/Proxy.sol:Proxy"
    )) as Proxy__factory;

    const proxy = await proxyFactory.deploy(await impl.getAddress(), "0x");
    await proxy.waitForDeployment();

    accountAddress = await proxy.getAddress();

    console.log(`Account(proxy): deployed to ${accountAddress}`);

    account = await ethers.getContractAt("Account", accountAddress);

    await account.initialize(runner.address, ENTRY_POINT_ADDRESS);
  }

  let plugin: Plugin;
  let pluginAddress: string;
  {
    const pluginFactory = await ethers.getContractFactory("Plugin");

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
