import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Account } from "@multiversx/sdk-core/out/index.js";
import { z } from "zod";
import {
  getEntrypoint,
  getExplorerUrl,
  isTokenNameValid,
  isTokenTickerValid,
  loadNetworkFromEnv,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function issueMetaEsdtCollection(
  tokenName: string,
  tokenTicker: string,
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

  const network = loadNetworkFromEnv();
  const entrypoint = getEntrypoint(network);

  account.nonce = await entrypoint.recallAccountNonce(account.address);

  const controller = entrypoint.createTokenManagementController();
  let transaction = await controller.createTransactionForRegisteringMetaEsdt(
    account,
    account.getNonceThenIncrement(),
    {
      tokenName: tokenName.toUpperCase(),
      tokenTicker: tokenTicker.toUpperCase(),
      numDecimals: BigInt(numDecimals),
      canFreeze: true,
      canWipe: true,
      canPause: true,
      canChangeOwner: true,
      canUpgrade: true,
      canAddSpecialRoles: true,
      canTransferNFTCreateRole: true,
    }
  );

  const issueCollectionHash = await entrypoint.sendTransaction(transaction);
  const outcome = await controller.awaitCompletedRegisterMetaEsdt(
    issueCollectionHash
  );

  const token = outcome[0].tokenIdentifier;
  transaction =
    await controller.createTransactionForSettingSpecialRoleOnMetaESDT(
      account,
      account.nonce,
      {
        user: account.address,
        tokenIdentifier: token,
        addRoleNFTCreate: true,
        addRoleNFTBurn: true,
        addRoleESDTTransferRole: true,
        addRoleNFTAddQuantity: true,
      }
    );
  const setRolesHash = await entrypoint.sendTransaction(transaction);

  const explorer = getExplorerUrl(network);
  return {
    content: [
      {
        type: "text",
        text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${issueCollectionHash}. A transaction to set roles has also been sent: ${explorer}/transactions/${setRolesHash}. The collection identifier is ${token} and should be used for creating tokens.`,
      },
    ],
  };
}

export const issueMetaEsdtCollectionToolName = "issue-meta-esdt-collection";
export const issueMetaEsdtCollectionToolDescription =
  "Create a transaction to issue a MetaESDT token collection (MESDT) and send it. Will issue the collection with the specified arguments. All the properties will be set to true.";
export const issueMetaEsdtCollectionParamScheme = {
  tokenName: z.string().describe("The token name."),
  tokenTicker: z.string().describe("The token ticker."),
  numDecimals: z.string().describe("The number of decimals."),
};
