import { ethers } from "hardhat";

const TOTAL_SUPPLY = "100000000000000000000000000" as const;

(async () => {
  {
    const ftFactory = await ethers.getContractFactory("FT");

    const ft = await ftFactory.deploy(TOTAL_SUPPLY);
    await ft.waitForDeployment();

    const ftAddress = await ft.getAddress();

    console.log(`FT: deployed to ${ftAddress}`);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
