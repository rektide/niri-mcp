import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";
import type { Workspace } from "./types.ts";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "workspaces"]);
	const result = JSON.parse(stdout) as Workspace[];
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
	name: "niri_workspaces",
	description: "List workspaces in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
