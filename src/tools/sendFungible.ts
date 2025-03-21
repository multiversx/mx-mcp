import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Account, Address, Token, TokenTransfer } from "@multiversx/sdk-core";
import { z } from "zod";
import {
  denominateValueWithDecimals,
  getEntrypoint,
  getExplorerUrl,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function sendFungible(
  token: string,
  amount: string,
  receiver: string
): Promise<CallToolResult> {
  const receiverAddress = Address.newFromBech32(receiver);

  const pem = loadPemWalletFromEnv();
  const account = new Account(pem.secretKey);
  const tokenObj = new Token({ identifier: token });

  const network = process.env.MVX_NETWORK;
  const entrypoint = getEntrypoint(network);
  const api = entrypoint.createNetworkProvider();

  const tokenOfAccount = await api.getTokenOfAccount(account.address, tokenObj);
  const tokenNumDecimals = tokenOfAccount.raw.decimals;
  const denominatedTokenAmount = denominateValueWithDecimals(
    amount,
    tokenNumDecimals
  );

  if (denominatedTokenAmount > tokenOfAccount.amount) {
    return {
      content: [
        {
          type: "text",
          text: `The token amount you want to transfer is larger than the available amount`,
        },
      ],
    };
  }

  account.nonce = await entrypoint.recallAccountNonce(account.address);

  const controller = entrypoint.createTransfersController();
  const transaction = await controller.createTransactionForTransfer(
    account,
    account.nonce,
    {
      receiver: receiverAddress,
      tokenTransfers: [
        new TokenTransfer({
          token: tokenObj,
          amount: denominatedTokenAmount,
        }),
      ],
    }
  );

  const hash = await entrypoint.sendTransaction(transaction);
  const explorer = getExplorerUrl(network);
  return {
    content: [
      {
        type: "text",
        text: `${amount} of ${token} have been sent to ${receiverAddress.toBech32()}. Check out the transaction here: ${explorer}/transactions/${hash}`,
      },
    ],
  };
}

export const sendFungibleToolName = "send-fungible-tokens";
export const sendFungibleToolDescription =
  "Create a fungible token transfer transaction and send it. Will send the specified token using the wallet set in the env to the specified receiver.";
export const sendFungibleParamScheme = {
  amount: z
    .string()
    .describe("The amount to send. This amount will then be denominated."),
  token: z.string().describe("The identifier of the token to send."),
  receiver: z.string().describe("The bech32 address of the receiver (erd1...)"),
};
