import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "outputs"]);
	const result = JSON.parse(stdout);
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
	name: "niri_outputs",
	description: "List connected outputs (monitors) in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
