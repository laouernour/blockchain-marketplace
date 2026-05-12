import { readFileSync, existsSync } from "fs";

const RPC_URL = "http://127.0.0.1:8545";

async function main() {
  if (!existsSync("hardhat-state.json")) {
    console.log("Aucun fichier hardhat-state.json trouve. Rien a restaurer.");
    return;
  }

  const state = JSON.parse(readFileSync("hardhat-state.json", "utf-8"));

  let res;
  try {
    res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "hardhat_loadState",
        params: [state],
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

  console.log("Etat restaure avec succes !");
}

main().catch(console.error);
