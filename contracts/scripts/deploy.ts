import hre from "hardhat";

async function main() {
  const { viem } = await hre.network.connect();

  const marketplace = await viem.deployContract("Marketplace");
  console.log("Marketplace deployed to:", marketplace.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});