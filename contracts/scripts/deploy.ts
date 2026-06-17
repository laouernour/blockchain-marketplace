import hre from "hardhat";

const ADMIN_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

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