import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  Account,
  Address,
  Token,
  TokenAmountOnNetwork,
  TokenComputer,
  TokenTransfer,
} from "@multiversx/sdk-core";
import { z } from "zod";
import {
  denominateValueWithDecimals,
  getEntrypoint,
  getExplorerUrl,
  loadPemWalletFromEnv,
} from "./utils.js";

export async function sendTokens(
  receiver: string,
  token: string,
  amount?: string
): Promise<CallToolResult> {
  const receiverAddress = Address.newFromBech32(receiver);

  const pem = loadPemWalletFromEnv();
  const account = new Account(pem.secretKey);

  const tokenComputer = new TokenComputer();
  const tokenObj = new Token({
    identifier: tokenComputer.extractIdentifierFromExtendedIdentifier(token),
    nonce: BigInt(tokenComputer.extractNonceFromExtendedIdentifier(token)),
  });

  const network = process.env.MVX_NETWORK;
  const entrypoint = getEntrypoint(network);
  const api = entrypoint.createNetworkProvider();

  let tokenOfAccount: TokenAmountOnNetwork;
  let finalAmount: bigint;

  try {
    tokenOfAccount = await api.getTokenOfAccount(account.address, tokenObj);
  } catch {
    return {
      content: [
        {
          type: "text",
          text: "Can't fetch token of the network",
        },
      ],
    };
  }

  if (tokenOfAccount.raw.type === "MetaESDT") {
    if (!amount) {
      return {
        content: [
          {
            type: "text",
            text: "No token amount provided for Meta ESDT",
          },
        ],
      };
    }

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

    finalAmount = denominatedTokenAmount;
  } else {
    if (tokenOfAccount.amount < 1) {
      return {
        content: [
          {
            type: "text",
            text: "The token amount you want to transfer is larger than the available amount",
          },
        ],
      };
    }
    finalAmount = amount ? BigInt(amount) : 1n;
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
          amount: finalAmount,
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
        text: `Token ${token} has been sent to ${receiverAddress.toBech32()}. Check out the transaction here: ${explorer}/transactions/${hash}`,
      },
    ],
  };
}

export const sendTokensToolName = "send-sft-nft-meta-tokens";
export const sendTokensToolDescription =
  "Create a nft, sft or meta esdt transfer transaction and send it. Will send the specified token using the wallet set in the env to the specified receiver.";
export const sendTokensParamScheme = {
  token: z
    .string()
    .describe(
      "The extended identifier of the token to send (e.g. NFTEST-123456-0a)."
    ),
  amount: z
    .string()
    .optional()
    .describe(
      "The amount of tokens to send. ONLY needed for SFT or Meta-ESDT."
    ),
  receiver: z.string().describe("The bech32 address of the receiver (erd1...)"),
};
