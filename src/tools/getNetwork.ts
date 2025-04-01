import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export async function getNetwork(): Promise<CallToolResult> {
  const network = process.env.MVX_NETWORK;

  return {
    content: [
      {
        type: "text",
        text: `The current used network is ${network}.`,
      },
    ],
  };
}

export const getNetworkToolName = "get-network";
export const getNetworkToolDescription =
  "Get the network set in the environment config";
