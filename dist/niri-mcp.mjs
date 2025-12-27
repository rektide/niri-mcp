import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { realpath } from "node:fs/promises";
import { x } from "tinyexec";
import { z } from "zod";

//#region tool/msg/outputs.ts
async function handler$3() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"outputs"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$3 = {
	name: "niri_outputs",
	description: "List connected outputs (monitors) in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$3
};

//#endregion
//#region tool/msg/workspaces.ts
async function handler$2() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"workspaces"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$2 = {
	name: "niri_workspaces",
	description: "List workspaces in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$2
};

//#endregion
//#region tool/msg/windows.ts
async function handler$1() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"windows"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$1 = {
	name: "niri_windows",
	description: "List open windows in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$1
};

//#endregion
//#region tool/msg/layers.ts
async function handler() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"layers"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool = {
	name: "niri_layers",
	description: "List layer-shell surfaces (like panels, menus) in Niri window manager",
	inputSchema: z.object({}),
	handler
};

//#endregion
//#region tool/msg/index.ts
const tools$1 = [
	tool$3,
	tool$2,
	tool$1,
	tool
];

//#endregion
//#region tool/index.ts
const tools = [...tools$1];

//#endregion
//#region niri-mcp.ts
const app = new Hono();
const mcpServer = new McpServer({
	name: "niri-mcp",
	version: "1.0.0"
});
const transport = new StreamableHTTPTransport();
function registerToolDefinition(definition) {
	mcpServer.registerTool(definition.name, {
		description: definition.description,
		inputSchema: definition.inputSchema
	}, definition.handler);
}
for (const toolDefinition of tools) registerToolDefinition(toolDefinition);
app.all("/mcp", async (c) => {
	if (!mcpServer.isConnected()) await mcpServer.connect(transport);
	return transport.handleRequest(c);
});
realpath(process.argv[1]).then((mainPath) => {
	if (import.meta.url.startsWith(`file://${mainPath}`)) serve({
		fetch: app.fetch,
		port: 3e3
	}, (info) => {
		console.log(`MCP server running at http://localhost:${info.port}/mcp`);
	});
}).catch(() => {});
var niri_mcp_default = app;

//#endregion
export { niri_mcp_default as default };