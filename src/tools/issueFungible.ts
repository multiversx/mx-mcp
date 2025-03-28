import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Account } from "@multiversx/sdk-core";
import { z } from "zod";
import {
  getEntrypoint,
  getExplorerUrl,
  isTokenNameValid,
  isTokenTickerValid,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function issueFungible(
  tokenName: string,
  tokenTicker: string,
  initialSupply: string,
  numDecimals: string
): Promise<CallToolResult> {
  if (!isTokenNameValid(tokenName)) {
    return {
      content: [
        {
          type: "text",
          text: `Token name is invalid. Length should be between 3 and 20 characters and contain only alphanumeric characters.`,
        },
      ],
    };
  }

  if (!isTokenTickerValid(tokenTicker)) {
    return {
      content: [
        {
          type: "text",
          text: `Token ticker is invalid. Length should be between 3 and 10 characters.`,
        },
      ],
    };
  }

  const pem = loadPemWalletFromEnv();
  const account = new Account(pem.secretKey);

  const network = process.env.MVX_NETWORK;
  const entrypoint = getEntrypoint(network);

  account.nonce = await entrypoint.recallAccountNonce(account.address);

  const controller = entrypoint.createTokenManagementController();
  const transaction = await controller.createTransactionForIssuingFungible(
    account,
    account.nonce,
    {
      tokenName: tokenName.toUpperCase(),
      tokenTicker: tokenTicker.toUpperCase(),
      initialSupply: BigInt(initialSupply),
      numDecimals: BigInt(numDecimals),
      canFreeze: true,
      canWipe: true,
      canPause: true,
      canChangeOwner: true,
      canUpgrade: true,
      canAddSpecialRoles: true,
    }
  );

  const hash = await entrypoint.sendTransaction(transaction);
  const outcome = await controller.awaitCompletedIssueFungible(hash);
  const token = outcome[0].tokenIdentifier;

  const explorer = getExplorerUrl(network);
  return {
    content: [
      {
        type: "text",
        text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${hash}. The collection identifier is ${token}.`,
      },
    ],
  };
}

export const issueFungibleToolName = "issue-fungible-token";
export const issueFungibleToolDescription =
  "Create a transaction to issue a fungible token and send it. Will issue the token with the specified arguments. All the properties will be set to true.";
export const issueFungibleParamScheme = {
  tokenName: z.string().describe("The token name."),
  tokenTicker: z.string().describe("The token ticker."),
  initialSupply: z.string().describe("The initial supply that will be minted."),
  numDecimals: z
    .string()
    .describe("The number of decimals the token will have."),
};
