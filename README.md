# MultiversX MCP Server

[![smithery badge](https://smithery.ai/badge/@multiversx/mx-mcp)](https://smithery.ai/server/@multiversx/mx-mcp)

This is an MCP Server created to work with the MultiversX blockchain. It provides basic functionality like creating PEM wallets, getting the wallet address, getting the balance of the wallet and sending tokens (EGLD, Fungible, SFT, NFT, MetaESDT).

### Installing via Smithery

To install mx-mcp for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@multiversx/mx-mcp):

```bash
npx -y @smithery/cli install @multiversx/mx-mcp --client claude
```

## Adding to Claude Desktop via JSON

Clone the repository, then build it using `npm run build`.

If not present, create a file called `claude_desktop_config.json` in `~/Library/Application\ Support/Claude/` on MacOS.

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

## Adding to cursor

Clone the project locally, then build it using the same command, `npm run build`.

Create a file in here: `~/.cursor/mcp.json`:
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

### or alternatively

Go to Cursor Settings -> MCP section, then add a new MCP. Give it a name, set type to `command` and in the command text box type `node absolute/path/to/index.js`.
