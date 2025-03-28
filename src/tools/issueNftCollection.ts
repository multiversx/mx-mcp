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

export async function issueNftCollection(
  tokenName: string,
  tokenTicker: string
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
  let transaction = await controller.createTransactionForIssuingNonFungible(
    account,
    account.getNonceThenIncrement(),
    {
      tokenName: tokenName.toUpperCase(),
      tokenTicker: tokenTicker.toUpperCase(),
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
  const outcome = await controller.awaitCompletedIssueNonFungible(
    issueCollectionHash
  );

  const token = outcome[0].tokenIdentifier;
  transaction =
    await controller.createTransactionForSettingSpecialRoleOnNonFungibleToken(
      account,
      account.nonce,
      {
        user: account.address,
        tokenIdentifier: token,
        addRoleNFTCreate: true,
        addRoleNFTBurn: true,
        addRoleESDTTransferRole: true,
        addRoleNFTAddURI: true,
        addRoleNFTUpdateAttributes: true,
        addRoleESDTModifyCreator: true,
        addRoleESDTModifyRoyalties: true,
        addRoleESDTSetNewURI: true,
        addRoleNFTRecreate: true,
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

export const issueNftCollectionToolName = "issue-nft-collection";
export const issueNftCollectionToolDescription =
  "Create a transaction to issue a non-fungible token collection (NFT) and send it. Will issue the collection with the specified arguments. All the properties will be set to true.";
export const issueNftCollectionParamScheme = {
  tokenName: z.string().describe("The token name."),
  tokenTicker: z.string().describe("The token ticker."),
};
