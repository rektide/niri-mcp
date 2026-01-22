import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { mkdir, readdir, realpath, rename, stat } from "node:fs/promises";
import { x } from "tinyexec";
import { z } from "zod";
import { join } from "node:path";

//#region tool/msg/outputs.ts
async function handler$9() {
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
const tool$9 = {
	name: "niri_outputs",
	description: "List connected outputs (monitors) in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$9
};

//#endregion
//#region tool/msg/workspaces.ts
async function handler$8() {
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
const tool$8 = {
	name: "niri_workspaces",
	description: "List workspaces in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$8
};

//#endregion
//#region tool/msg/windows.ts
async function handler$7() {
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
const tool$7 = {
	name: "niri_windows",
	description: "List open windows in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$7
};

//#endregion
//#region tool/msg/layers.ts
async function handler$6() {
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
const tool$6 = {
	name: "niri_layers",
	description: "List layer-shell surfaces (like panels, menus) in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$6
};

//#endregion
//#region tool/msg/keyboard-layouts.ts
async function handler$5() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"keyboard-layouts"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$5 = {
	name: "niri_keyboard_layouts",
	description: "List keyboard layouts in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$5
};

//#endregion
//#region tool/msg/focused-output.ts
async function handler$4() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"focused-output"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$4 = {
	name: "niri_focused_output",
	description: "Get the currently focused output (monitor) in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$4
};

//#endregion
//#region tool/msg/focused-window.ts
async function handler$3() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"focused-window"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$3 = {
	name: "niri_focused_window",
	description: "Get the currently focused window in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$3
};

//#endregion
//#region tool/msg/overview-state.ts
async function handler$2() {
	const { stdout } = await x("niri", [
		"msg",
		"--json",
		"overview-state"
	]);
	const result = JSON.parse(stdout);
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool$2 = {
	name: "niri_overview_state",
	description: "Get the overview state in Niri window manager",
	inputSchema: z.object({}),
	handler: handler$2
};

//#endregion
//#region tool/msg/types.ts
const OutputModeSchema = z.object({
	width: z.number(),
	height: z.number(),
	refresh_rate: z.number(),
	is_preferred: z.boolean()
});
const OutputLogicalSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	scale: z.number(),
	transform: z.enum([
		"Normal",
		"90",
		"180",
		"270",
		"Flipped",
		"Flipped-90",
		"Flipped-180",
		"Flipped-270"
	])
});
const OutputSchema = z.object({
	name: z.string(),
	make: z.string().nullable(),
	model: z.string(),
	serial: z.string().nullable(),
	physical_size: z.tuple([z.number(), z.number()]),
	modes: z.array(OutputModeSchema),
	current_mode: z.number(),
	is_custom_mode: z.boolean(),
	vrr_supported: z.boolean(),
	vrr_enabled: z.boolean(),
	logical: OutputLogicalSchema
});
const WorkspaceSchema = z.object({
	id: z.number(),
	idx: z.number(),
	name: z.string().nullable(),
	output: z.string(),
	is_urgent: z.boolean(),
	is_active: z.boolean(),
	is_focused: z.boolean(),
	active_window_id: z.number().nullable()
});
const WindowLayoutSchema = z.object({
	pos_in_scrolling_layout: z.tuple([z.number(), z.number()]),
	tile_size: z.tuple([z.number(), z.number()]),
	window_size: z.tuple([z.number(), z.number()]),
	tile_pos_in_workspace_view: z.nullable(z.tuple([z.number(), z.number()])),
	window_offset_in_tile: z.tuple([z.number(), z.number()])
});
const FocusTimestampSchema = z.object({
	secs: z.number(),
	nanos: z.number()
});
const WindowSchema = z.object({
	id: z.number(),
	title: z.string(),
	app_id: z.string(),
	pid: z.number(),
	workspace_id: z.number(),
	is_focused: z.boolean(),
	is_floating: z.boolean(),
	is_urgent: z.boolean(),
	layout: WindowLayoutSchema,
	focus_timestamp: FocusTimestampSchema
});
const KeyboardLayoutsSchema = z.object({
	names: z.array(z.string()),
	current_idx: z.number()
});
const OverviewStateSchema = z.object({ is_open: z.boolean() });

//#endregion
//#region tool/msg/index.ts
const tools$1 = [
	tool$9,
	tool$8,
	tool$7,
	tool$6,
	tool$5,
	tool$4,
	tool$3,
	tool$2
];

//#endregion
//#region tool/config/scan.ts
async function scanConfigDir(dirPath, filter) {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		const configs = [];
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			const filename = entry.name;
			if (!applyConfigFilter(filename, filter)) continue;
			const filePath = join(dirPath, filename);
			const state = determineConfigState(filename);
			let size;
			try {
				size = (await stat(filePath)).size;
			} catch {
				size = void 0;
			}
			configs.push({
				name: filename,
				path: filePath,
				state,
				size
			});
		}
		return configs.sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		if (error.code === "ENOENT") {
			await mkdir(dirPath, { recursive: true });
			return [];
		}
		throw error;
	}
}
function determineConfigState(filename) {
	if (filename.endsWith(".disabled")) return "excluded";
	return "included";
}
function applyConfigFilter(filename, pattern) {
	if (!pattern) return true;
	try {
		return new RegExp(pattern).test(filename);
	} catch {
		return false;
	}
}

//#endregion
//#region tool/config/list.ts
const inputSchema$1 = z.object({ filter: z.string().optional() });
async function handler$1() {
	const configs = await scanConfigDir(`${process.env.HOME}/.config/niri/config.d`);
	return { content: [{
		type: "text",
		text: JSON.stringify(configs, null, 2)
	}] };
}
const tool$1 = {
	name: "list_niri_configs",
	description: "List niri config.d files with their state (included/excluded)",
	inputSchema: inputSchema$1,
	handler: handler$1
};

//#endregion
//#region tool/config/toggle.ts
const inputSchema = z.object({
	idRegex: z.string().optional(),
	action: z.enum([
		"on",
		"off",
		"toggle"
	]).default("toggle")
});
async function handler() {
	const dirPath = `${process.env.HOME}/.config/niri/config.d`;
	const action = "toggle";
	const configs = await scanConfigDir(dirPath);
	const affected = [];
	const skipped = [];
	for (const config of configs) {
		const previousState = config.state;
		let newState;
		const isExcluded = config.state === "excluded";
		const isIncluded = config.state === "included";
		switch (action) {
			case "on":
				if (isExcluded) {
					const newPath = config.path.replace(/\.disabled$/, "");
					try {
						await rename(config.path, newPath);
						newState = "included";
					} catch (error) {
						skipped.push({
							name: config.name,
							reason: error.message
						});
					}
				}
				break;
			case "off":
				if (isIncluded) {
					const newPath = `${config.path}.disabled`;
					try {
						await rename(config.path, newPath);
						newState = "excluded";
					} catch (error) {
						skipped.push({
							name: config.name,
							reason: error.message
						});
					}
				}
				break;
			case "toggle":
				if (isIncluded) {
					const newPath = `${config.path}.disabled`;
					try {
						await rename(config.path, newPath);
						newState = "excluded";
					} catch (error) {
						skipped.push({
							name: config.name,
							reason: error.message
						});
					}
				} else {
					const newPath = config.path.replace(/\.disabled$/, "");
					try {
						await rename(config.path, newPath);
						newState = "included";
					} catch (error) {
						skipped.push({
							name: config.name,
							reason: error.message
						});
					}
				}
				break;
		}
		if (newState) affected.push({
			name: config.name,
			previousState,
			newState,
			path: config.path
		});
	}
	const result = {
		affected,
		skipped
	};
	return { content: [{
		type: "text",
		text: JSON.stringify(result, null, 2)
	}] };
}
const tool = {
	name: "toggle_niri_config",
	description: "Toggle niri config.d files (enable/disable)",
	inputSchema,
	handler
};

//#endregion
//#region tool/index.ts
const tools = [
	...tools$1,
	tool$1,
	tool
];

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