import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Account, Address } from "@multiversx/sdk-core";
import { z } from "zod";
import {
  denominateEgldValue,
  getEntrypoint,
  getExplorerUrl,
  loadNetworkFromEnv,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function sendEgld(
  amount: string,
  receiver: string
): Promise<CallToolResult> {
  const denominated = denominateEgldValue(amount);
  const pem = loadPemWalletFromEnv();
  const receiverAddress = Address.newFromBech32(receiver);
  const account = new Account(pem.secretKey);

  const network = loadNetworkFromEnv();
  const entrypoint = getEntrypoint(network);

  const accountOnNetwork = await entrypoint
    .createNetworkProvider()
    .getAccount(account.address);

  if (denominated > accountOnNetwork.balance) {
    throw new Error("Not enough EGLD balance");
  }

  account.nonce = accountOnNetwork.nonce;

  const controller = entrypoint.createTransfersController();
  const transaction = await controller.createTransactionForTransfer(
    account,
    account.nonce,
    {
      receiver: receiverAddress,
      nativeAmount: denominated,
    }
  );

  const hash = await entrypoint.sendTransaction(transaction);
  const explorer = getExplorerUrl(network);
  return {
    content: [
      {
        type: "text",
        text: `${amount} EGLD have been sent to ${receiverAddress.toBech32()}. Check out the transaction here: ${explorer}/transactions/${hash}`,
      },
    ],
  };
}

export const sendEgldToolName = "send-egld";
export const sendEgldToolDescription =
  "Create a move balance transaction and send it. Will send EGLD using the wallet set in the env to the specified receiver.";
export const sendEgldParamScheme = {
  amount: z
    .string()
    .describe(
      "The amount of EGLD to send. This amount will then be denominated (1 EGLD=1000000000000000000)"
    ),
  receiver: z.string().describe("The bech32 address of the receiver (erd1...)"),
};
