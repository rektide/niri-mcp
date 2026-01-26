import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";
import type { OverviewState } from "./types.ts";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "overview-state"]);
	const result = JSON.parse(stdout) as OverviewState;
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
	name: "niri_overview_state",
	description: "Get the overview state in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
