import hre from "hardhat";

const ADMIN_ADDRESS = "0x1164697bb17EaB2DA95266b380d691A853a9ac08";

async function main() {
  const { viem } = await hre.network.connect();

  const marketplace = await viem.deployContract("Marketplace", [ADMIN_ADDRESS]);
  console.log("Marketplace deployed to:", marketplace.address);
  console.log("Admin défini à         :", ADMIN_ADDRESS);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});