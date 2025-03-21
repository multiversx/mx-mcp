import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Address, ApiNetworkProvider } from "@multiversx/sdk-core";
import { BigNumber } from "bignumber.js";
import { z } from "zod";
import { USER_AGENT } from "./constants.js";
import { getApiUrl } from "./utils.js";

export async function getBalance(address: string): Promise<CallToolResult> {
  let addressObj: Address;

  try {
    addressObj = Address.newFromBech32(address);
  } catch {
    return {
      content: [
        {
          type: "text",
          text: "Invalid address. Please provide a bech32 address (erd1...)",
        },
      ],
    };
  }

  const network = process.env.MVX_NETWORK;
  const api = new ApiNetworkProvider(getApiUrl(network), {
    clientName: USER_AGENT,
  });

  const account = await api.getAccount(addressObj);
  const balance = new BigNumber(account.balance.toString());
  const formattedBalance = balance.div(new BigNumber(10).pow(18)).toString();

  return {
    content: [
      {
        type: "text",
        text: `The balance for ${addressObj.toBech32()} is ${formattedBalance} EGLD.`,
      },
    ],
  };
}

export const getBalanceToolName = "get-balance-of-address";
export const getBalanceToolDescription =
  "Get the balance for a MultiversX address";
export const getBalanceParamScheme = {
  address: z.string().describe("The bech32 representation of the address"),
};
