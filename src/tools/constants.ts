import { homedir } from "os";
import { resolve } from "path";

export const MULTIVERSX_DIR = resolve(homedir(), ".multiversx");
export const MULTIVERSX_WALLET_NAME = "wallet.pem";
export const EGLD_NUM_DECIMALS = 18;
export const USER_AGENT = "sdk-multiversx-mcp";
export const MIN_GAS_LIMIT = 50_000n;
