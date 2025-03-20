import { homedir } from "os"; // Import `homedir` to expand `~`
import { resolve } from "path";

export const MULTIVERSX_DIR = resolve(homedir(), ".multiversx"); // Correctly expand home directory
export const MULTIVERSX_WALLET_NAME = "wallet.pem";
export const EGLD_NUM_DECIMALS = 18;
