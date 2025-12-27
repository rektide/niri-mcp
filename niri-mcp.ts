import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { realpath } from "node:fs/promises";

const app = new Hono();
const mcpServer = new McpServer({
	name: "niri-mcp",
	version: "1.0.0",
});

const transport = new StreamableHTTPTransport();

app.all("/mcp", async (c) => {
	if (!mcpServer.isConnected()) {
		await mcpServer.connect(transport);
	}

	return transport.handleRequest(c);
});

realpath(process.argv[1]).then((mainPath) => {
	if (import.meta.url.startsWith(`file://${mainPath}`)) {
		const port = 3000;

		serve({
			fetch: app.fetch,
			port,
		}, (info) => {
			console.log(`MCP server running at http://localhost:${info.port}/mcp`);
		});
	}
}).catch(() => {});

export default app;
