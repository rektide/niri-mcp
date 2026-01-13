import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "layers"]);
	const result = JSON.parse(stdout) as unknown[];
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(result, null, 2),
			},
		],
	};
}

export const tool: ToolDefinition = {
	name: "niri_layers",
	description: "List layer-shell surfaces (like panels, menus) in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
