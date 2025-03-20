import {
  DevnetEntrypoint,
  MainnetEntrypoint,
  TestnetEntrypoint,
  UserPem,
} from "@multiversx/sdk-core";
import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import { EGLD_NUM_DECIMALS } from "./constants.js";

const API_URLS = {
  devnet: "https://devnet-api.multiversx.com",
  testnet: "https://testnet-api.multiversx.com",
  mainnet: "https://api.multiversx.com",
};

const ENTRYPOINTS = {
  devnet: new DevnetEntrypoint(),
  testnet: new TestnetEntrypoint(),
  mainnet: new MainnetEntrypoint(),
};

const EXPLORER_URLS = {
  devnet: "https://devnet-explorer.multiversx.com",
  testnet: "https://testnet-explorer.multiversx.com",
  mainnet: "https://explorer.multiversx.com",
};

export const getApiUrl = (network: string): string => {
  if (!(network in API_URLS)) {
    throw Error(
      `Invalid network: ${network}. Allowed values: ${Object.keys(
        API_URLS
      ).join(", ")}`
    );
  }
  return API_URLS[network as keyof typeof API_URLS];
};

export const loadPemWalletFromEnv = (): UserPem => {
  const walletPath = process.env.MVX_WALLET;

  if (!walletPath) {
    throw new Error("Wallet path not set in config file.");
  }

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet file does not exist at: ${walletPath}`);
  }

  if (fs.statSync(walletPath).isDirectory()) {
    throw new Error(
      `MVX_WALLET points to a directory, not a file: ${walletPath}`
    );
  }

  fs.chmodSync(walletPath, 0o644);
  return UserPem.fromFile(walletPath);
};

export const getEntrypoint = (network: string) => {
  if (!(network in ENTRYPOINTS)) {
    throw Error(
      `Invalid network: ${network}. Allowed values: ${Object.keys(
        ENTRYPOINTS
      ).join(", ")}`
    );
  }
  return ENTRYPOINTS[network as keyof typeof ENTRYPOINTS];
};

export const denominateEgldValue = (value: string): bigint => {
  return denominateValueWithDecimals(value, EGLD_NUM_DECIMALS);
};

export const getExplorerUrl = (network: string): string => {
  if (!(network in EXPLORER_URLS)) {
    throw Error(
      `Invalid network: ${network}. Allowed values: ${Object.keys(
        EXPLORER_URLS
      ).join(", ")}`
    );
  }
  return EXPLORER_URLS[network as keyof typeof EXPLORER_URLS];
};

export const denominateValueWithDecimals = (
  value: string,
  decimals: number
): bigint => {
  const factor = new BigNumber(10).pow(decimals);
  const denominated = new BigNumber(value).times(factor).toFixed(0);
  return BigInt(denominated);
};
