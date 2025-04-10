# MultiversX MCP Server

[![smithery badge](https://smithery.ai/badge/@multiversx/mx-mcp)](https://smithery.ai/server/@multiversx/mx-mcp)

This is an MCP Server created to work with the MultiversX blockchain. It provides basic functionality like creating PEM wallets, getting the wallet address, getting the balance of the wallet and sending tokens (EGLD, Fungible, SFT, NFT, MetaESDT).

## Overview

- Create a wallet. Creates a PEM wallet at: `~/.multiversx/wallet.pem`.
- Get the current network set for the environment.
- Get the wallet address set in the envirnment.
- Fetch the balance of an address.
- Send tokens.
- Issue tokens.

## Adding to Claude Desktop via JSON

Ensure you have [Claude Desktop](https://claude.ai/download) installed.

Open or create the Claude configuration file:

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`
Linux: `~/.config/Claude/claude_desktop_config.json`

Add the mcp server to your configuration:

```json
{
    "mcpServers": {
        "multiversx-mcp": {
            "command": "npx",
            "args": [
                "-y",
                "@multiversx/mcp"
            ],
            "env": {
                "MVX_NETWORK": "devnet",
                "MVX_WALLET": "absolute/path/to/someWallet.pem"
            }
        }
    }
}
```

## Adding to cursor

The same JSON configuration from above works for Cursor (version >= 0.47). Add the config in the `~/.cursor/mcp.json` config file. Or alternatively, go to Cursor Settings -> MCP section, then add a new MCP.

### Build from source

Clone the repository, then run `npm run build`.

In the config file, set the server to the one you've just built.

```json
{
    "mcpServers": {
        "multiversx-mcp": {
            "command": "node",
            "args": [
               "absolute/path/to/index.js"
            ],
         "env": {
            "MVX_NETWORK": "devnet",
            "MVX_WALLET": "absolute/path/to/someWallet.pem"
          }
        }
    }
}
```
