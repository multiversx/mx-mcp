import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  Account,
  Address,
  ApiNetworkProvider,
  Token,
  TokenAmountOnNetwork,
  TokenComputer,
  TokenTransfer,
  UserPem,
  UserSecretKey,
} from "@multiversx/sdk-core";
import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import { resolve } from "path";
import { z } from "zod";
import { MULTIVERSX_DIR, MULTIVERSX_WALLET_NAME } from "./constants.js";
import {
  denominateEgldValue,
  denominateValueWithDecimals,
  getApiUrl,
  getEntrypoint,
  getExplorerUrl,
  loadPemWalletFromEnv,
} from "./utils.js";

const USER_AGENT = "sdk-multiversx-mcp";

// Create server instance
const server = new McpServer({
  name: "multiversx-mcp",
  version: "1.0.0",
});

server.tool(
  "get-balance",
  "Get the balance for a MultiversX address",
  {
    address: z.string().describe("The bech32 representation of the address"),
  },
  async ({ address }) => {
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
);

server.tool(
  "get-wallet-address",
  "Get the bech32 address of the wallet set in the environment config",
  async () => {
    const pem = loadPemWalletFromEnv();
    return {
      content: [
        {
          type: "text",
          text: `The bech32 address is ${pem.label}.`,
        },
      ],
    };
  }
);

server.tool(
  "create-wallet",
  "Create a new wallet and save it as a PEM file. PEM file ARE NOT SECURE. If a wallet already exists, will abort operation.",
  async () => {
    const walletPath = resolve(MULTIVERSX_DIR, MULTIVERSX_WALLET_NAME);

    if (fs.existsSync(walletPath)) {
      return {
        content: [
          {
            type: "text",
            text: `A wallet exists at location ${walletPath}. Will not overwrite it.`,
          },
        ],
      };
    }

    const secretKey = UserSecretKey.generate();
    const address = secretKey.generatePublicKey().toAddress();
    const pem = new UserPem(address.toBech32(), secretKey);

    pem.save(walletPath);
    fs.chmodSync(walletPath, 0o666);
    return {
      content: [
        {
          type: "text",
          text: `A wallet has been created and saved as a PEM file at: ${walletPath}. PEM files ARE NOT SECURE.
          If you want to further use the generated wallet, make sure to fund it first and set the absolute path in the "claude_desktop_config.json" under the "MVX_WALLET" environment variable.`,
        },
      ],
    };
  }
);

server.tool(
  "send-egld",
  "Create a move balance transaction and send it. Will send EGLD using the wallet set in the env to the specified receiver.",
  {
    amount: z
      .string()
      .describe(
        "The amount of EGLD to send. This amount will then be denominated (1 EGLD=1000000000000000000)"
      ),
    receiver: z
      .string()
      .describe("The bech32 address of the receiver (erd1...)"),
  },
  async ({ amount, receiver }) => {
    const denominated = denominateEgldValue(amount);
    const pem = loadPemWalletFromEnv();
    const receiverAddress = Address.newFromBech32(receiver);
    const account = new Account(pem.secretKey);

    const network = process.env.MVX_NETWORK;
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
);

server.tool(
  "send-fungible-tokens",
  "Create a fungible token transfer transaction and send it. Will send the specified token using the wallet set in the env to the specified receiver.",
  {
    amount: z
      .string()
      .describe("The amount to send. This amount will then be denominated."),
    token: z.string().describe("The identifier of the token to send."),
    receiver: z
      .string()
      .describe("The bech32 address of the receiver (erd1...)"),
  },
  async ({ amount, token, receiver }) => {
    const receiverAddress = Address.newFromBech32(receiver);

    const pem = loadPemWalletFromEnv();
    const account = new Account(pem.secretKey);
    const tokenObj = new Token({ identifier: token });

    const network = process.env.MVX_NETWORK;
    const entrypoint = getEntrypoint(network);
    const api = entrypoint.createNetworkProvider();

    const tokenOfAccount = await api.getTokenOfAccount(
      account.address,
      tokenObj
    );
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
);

server.tool(
  "send-nft-sft-meta-tokens",
  "Create a nft, sft or meta esdt transfer transaction and send it. Will send the specified token using the wallet set in the env to the specified receiver.",
  {
    token: z
      .string()
      .describe(
        "The extended identifier of the nft to send (e.g. NFTEST-123456-0a)."
      ),
    amount: z
      .string()
      .optional()
      .describe(
        "The amount of tokens to send. ONLY needed for SFT or Meta-ESDT."
      ),
    receiver: z
      .string()
      .describe("The bech32 address of the receiver (erd1...)"),
  },
  async ({ token, amount, receiver }) => {
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
);

server.tool(
  "issue-fungible-token",
  "Create a transaction to issue a fungible token and send it. Will issue the token with the specified arguments. All the properties will be set to true.",
  {
    tokenName: z.string().describe("The token name."),
    tokenTicker: z.string().describe("The token ticker."),
    initialSupply: z
      .string()
      .describe("The initial supply that will be minted."),
    numDecimals: z
      .string()
      .describe("The number of decimals the token will have."),
  },
  async ({ tokenName, tokenTicker, initialSupply, numDecimals }) => {
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
        tokenName: tokenName,
        tokenTicker: tokenTicker,
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
    const explorer = getExplorerUrl(network);
    return {
      content: [
        {
          type: "text",
          text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${hash}`,
        },
      ],
    };
  }
);

server.tool(
  "issue-semi-fungible-collection",
  "Create a transaction to issue a semi-fungible collection (SFT) and send it. Will issue the collection with the specified arguments. All the properties will be set to true.",
  {
    tokenName: z.string().describe("The token name."),
    tokenTicker: z.string().describe("The token ticker."),
  },
  async ({ tokenName, tokenTicker }) => {
    const pem = loadPemWalletFromEnv();
    const account = new Account(pem.secretKey);

    const network = process.env.MVX_NETWORK;
    const entrypoint = getEntrypoint(network);

    account.nonce = await entrypoint.recallAccountNonce(account.address);

    const controller = entrypoint.createTokenManagementController();
    let transaction = await controller.createTransactionForIssuingSemiFungible(
      account,
      account.getNonceThenIncrement(),
      {
        tokenName: tokenName,
        tokenTicker: tokenTicker,
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
    const outcome = await controller.awaitCompletedIssueSemiFungible(
      issueCollectionHash
    );

    const token = outcome[0].tokenIdentifier;
    transaction =
      await controller.createTransactionForSettingSpecialRoleOnSemiFungibleToken(
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
          text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${issueCollectionHash}. A transaction to set roles has also been sent: ${explorer}/transactions/${setRolesHash}`,
        },
      ],
    };
  }
);

server.tool(
  "issue-nft-collection",
  "Create a transaction to issue a non-fungible token collection (NFT) and send it. Will issue the collection with the specified arguments. All the properties will be set to true.",
  {
    tokenName: z.string().describe("The token name."),
    tokenTicker: z.string().describe("The token ticker."),
  },
  async ({ tokenName, tokenTicker }) => {
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
        tokenName: tokenName,
        tokenTicker: tokenTicker,
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
          text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${issueCollectionHash}. A transaction to set roles has also been sent: ${explorer}/transactions/${setRolesHash}`,
        },
      ],
    };
  }
);

server.tool(
  "issue-meta-esdt-collection",
  "Create a transaction to issue a MetaESDT token collection (MESDT) and send it. Will issue the collection with the specified arguments. All the properties will be set to true.",
  {
    tokenName: z.string().describe("The token name."),
    tokenTicker: z.string().describe("The token ticker."),
    numDecimals: z.string().describe("The number of decimals."),
  },
  async ({ tokenName, tokenTicker, numDecimals }) => {
    const pem = loadPemWalletFromEnv();
    const account = new Account(pem.secretKey);

    const network = process.env.MVX_NETWORK;
    const entrypoint = getEntrypoint(network);

    account.nonce = await entrypoint.recallAccountNonce(account.address);

    const controller = entrypoint.createTokenManagementController();
    let transaction = await controller.createTransactionForRegisteringMetaEsdt(
      account,
      account.getNonceThenIncrement(),
      {
        tokenName: tokenName,
        tokenTicker: tokenTicker,
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
          text: `The transaction has been sent. Check out the transaction here: ${explorer}/transactions/${issueCollectionHash}. A transaction to set roles has also been sent: ${explorer}/transactions/${setRolesHash}`,
        },
      ],
    };
  }
);

server.tool(
  "issue-semi-fungible-or-nft-or-meta-esdt-token",
  "Create a transaction to issue a semi-fungible token (SFT), or a non-fungible token (NFT), or a MetaESDT token for a collection and send it. Will issue the token with the specified arguments.",
  {
    tokenIdentifier: z.string().describe("The identifier of the collection."),
    initialQuantity: z
      .string()
      .optional()
      .describe(
        "The initial quantity that will be minted. If not provided, defaults to 1."
      ),
    name: z.string().describe("The name of the token."),
    royalties: z.string().optional().describe("The royalties you'll receive."),
  },
  async ({ tokenIdentifier, initialQuantity, name, royalties }) => {
    const pem = loadPemWalletFromEnv();
    const account = new Account(pem.secretKey);

    const network = process.env.MVX_NETWORK;
    const entrypoint = getEntrypoint(network);

    account.nonce = await entrypoint.recallAccountNonce(account.address);

    const controller = entrypoint.createTokenManagementController();
    let transaction = await controller.createTransactionForCreatingNft(
      account,
      account.getNonceThenIncrement(),
      {
        tokenIdentifier: tokenIdentifier,
        initialQuantity: initialQuantity ? BigInt(initialQuantity) : 1n,
        name: name,
        royalties: royalties ? Number(royalties) * 100 : 0,
        hash: "",
        attributes: new Uint8Array(),
        uris: [],
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
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MultiversX MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
