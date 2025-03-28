import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Account, Address } from "@multiversx/sdk-core";
import { z } from "zod";
import { MIN_GAS_LIMIT } from "./constants.js";
import {
  denominateEgldValue,
  getEntrypoint,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function sendEgldToMultipleReceivers(
  amount: string,
  receivers: string[]
): Promise<CallToolResult> {
  const denominated = denominateEgldValue(amount);
  const pem = loadPemWalletFromEnv();

  const account = new Account(pem.secretKey);

  const network = process.env.MVX_NETWORK;
  const entrypoint = getEntrypoint(network);

  const accountOnNetwork = await entrypoint
    .createNetworkProvider()
    .getAccount(account.address);

  const requiredBalance =
    denominated * BigInt(receivers.length) +
    MIN_GAS_LIMIT * BigInt(receivers.length);

  if (requiredBalance < accountOnNetwork.balance) {
    throw new Error("Not enough EGLD balance");
  }

  let hashes: string[] = [];

  const controller = entrypoint.createTransfersController();
  account.nonce = accountOnNetwork.nonce;

  receivers.forEach(async (receiver) => {
    const receiverAddress = Address.newFromBech32(receiver);

    const transaction = await controller.createTransactionForTransfer(
      account,
      account.nonce,
      {
        receiver: receiverAddress,
        nativeAmount: denominated,
      }
    );

    const hash = await entrypoint.sendTransaction(transaction);
    hashes.push(hash);
  });

  return {
    content: [
      {
        type: "text",
        text: `${amount} EGLD has been sent to each receiver. Check out the transactions hashes here: ${hashes.join(
          ", "
        )}`,
      },
    ],
  };
}

export const sendEgldToMultipleReceiversToolName =
  "send-egld-to-multiple-receivers";
export const sendEgldToMultipleReceiversToolDescription =
  "Create move balance transactions and send them. Will send EGLD using the wallet set in the env to each specified receiver.";
export const sendEgldToMultipleReceiversParamScheme = {
  amount: z
    .string()
    .describe(
      "The amount of EGLD to send. This amount will then be denominated (1 EGLD=1000000000000000000)"
    ),
  receivers: z
    .array(z.string())
    .describe("An array of bech32 addresses of the receivers (erd1...)"),
};
