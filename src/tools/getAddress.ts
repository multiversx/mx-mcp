import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadPemWalletFromEnv } from "./utils.js";

export async function getAddress(): Promise<CallToolResult> {
  const pem = loadPemWalletFromEnv();
  return {
    content: [
      {
        type: "text",
        text: `The bech32 address is ${pem.label}.`,
      },
    ],
  };
}

export const getAddressToolName = "get-wallet-address";
export const getAddressToolDescription =
  "Get the bech32 address of the wallet set in the environment config";
