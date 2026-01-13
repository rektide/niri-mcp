import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";
import type { Output } from "./types.js";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "focused-output"]);
	const result = JSON.parse(stdout) as Output;
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
	name: "niri_focused_output",
	description: "Get the currently focused output (monitor) in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
