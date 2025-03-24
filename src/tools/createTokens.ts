import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Account } from "@multiversx/sdk-core";
import { z } from "zod";
import {
  getEntrypoint,
  getExplorerUrl,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function createTokens(
  tokenIdentifier: string,
  name: string,
  royalties?: string,
  initialQuantity?: string
): Promise<CallToolResult> {
  const pem = loadPemWalletFromEnv();
  const account = new Account(pem.secretKey);

  const network = process.env.MVX_NETWORK;
  const entrypoint = getEntrypoint(network);

  account.nonce = await entrypoint.recallAccountNonce(account.address);

  const controller = entrypoint.createTokenManagementController();

  let quantity = initialQuantity ? BigInt(initialQuantity) : 1n;

  //   in case the token is MetaESDT, we need to multiply the desired minted amount with the number of decimals
  const api = entrypoint.createNetworkProvider();
  const collection = await api.getDefinitionOfTokenCollection(tokenIdentifier);
  if (collection.type === "MetaESDT") {
    quantity = quantity * 10n ** BigInt(collection.decimals);
  }

  tokenIdentifier = collection.collection;

  let transaction = await controller.createTransactionForCreatingNft(
    account,
    account.getNonceThenIncrement(),
    {
      tokenIdentifier: tokenIdentifier,
      initialQuantity: quantity,
      name: name,
      royalties: royalties ? Number(royalties) * 100 : 0,
      hash: "",
      attributes: new Uint8Array(),
      uris: [""],
    }
  );

  const hash = await entrypoint.sendTransaction(transaction);

  const explorer = getExplorerUrl(network);
  return {
    content: [
      {
        type: "text",
        text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${hash}.`,
      },
    ],
  };
}

export const createTokensToolName = "create-sft-nft-mesdt-tokens";
export const createTokensToolDescription =
  "Create a transaction to issue a semi-fungible token (SFT), or a non-fungible token (NFT), or a MetaESDT token for a collection and send it. Will issue the token with the specified arguments.";
export const createTokensParamScheme = {
  tokenIdentifier: z.string().describe("The identifier of the collection."),
  initialQuantity: z
    .string()
    .optional()
    .describe(
      "The initial quantity that will be minted. If not provided, defaults to 1."
    ),
  name: z.string().describe("The name of the token."),
  royalties: z.string().optional().describe("The royalties you'll receive."),
};
