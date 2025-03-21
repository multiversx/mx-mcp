import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./setupServer.js";

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MultiversX MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
