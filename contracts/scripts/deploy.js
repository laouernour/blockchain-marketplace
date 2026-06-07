import { createWalletClient, createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const artifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/Marketplace.sol/Marketplace.json"), "utf8")
);

// Compte 1 Hardhat (deployer)
const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const walletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

async function main() {
  console.log("Deploying with:", account.address);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [account.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  console.log("Marketplace deployed to:", address);
  console.log("Admin address:", account.address);

  // Mise à jour automatique du config frontend
  const configPath = join(__dirname, "../../frontend/src/config.js");
  const { writeFileSync } = await import("fs");
  writeFileSync(
    configPath,
    `export const CONTRACT_ADDRESS = "${address}";\nexport const ADMIN_ADDRESS = "${account.address}";\n`
  );
  console.log("config.js mis à jour automatiquement");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
