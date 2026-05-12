import { writeFileSync } from "fs";

const RPC_URL = "http://127.0.0.1:8545";

async function main() {
  let res;
  try {
    res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "hardhat_dumpState",
        params: [],
      }),
    });
  } catch {
    console.error("Erreur : le node Hardhat n'est pas lancé (http://127.0.0.1:8545)");
    process.exit(1);
  }

  const json = await res.json();

  if (json.error) {
    console.error("Erreur RPC:", json.error.message);
    process.exit(1);
  }

  writeFileSync("hardhat-state.json", JSON.stringify(json.result));
  console.log("Etat sauvegarde dans hardhat-state.json");
}

main().catch(console.error);
