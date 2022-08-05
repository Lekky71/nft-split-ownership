import { ethers, upgrades } from "hardhat";

async function main() {
  // Hardhat always runs the 'Compile' task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const FNFToken = await ethers.getContractFactory("FNFToken");
  const fnFToken = await FNFToken.deploy();
  // We get the contract to deploy
  const NftSplitterV1 = await ethers.getContractFactory("NftSplitterV1");
  console.log("FNFToken deployed to:", fnFToken.address);

  const nftSplitterV1 = await upgrades.deployProxy(NftSplitterV1,
    ['0x41edd58578FFF43Fbe3081f48C0d4F46635DA7f0', fnFToken.address, 5000000000000000], {
      initializer: 'initialize'
    });

  await nftSplitterV1.deployed();

  console.log("NftSplitterV1 deployed to:", nftSplitterV1.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
