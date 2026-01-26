import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";
import type { Window } from "./types.ts";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "focused-window"]);
	const result = JSON.parse(stdout) as Window;
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
	name: "niri_focused_window",
	description: "Get the currently focused window in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
