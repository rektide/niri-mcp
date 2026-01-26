import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";
import type { KeyboardLayouts } from "./types.ts";

async function handler() {
	const { stdout } = await x("niri", ["msg", "--json", "keyboard-layouts"]);
	const result = JSON.parse(stdout) as KeyboardLayouts;
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
	name: "niri_keyboard_layouts",
	description: "List keyboard layouts in Niri window manager",
	inputSchema: z.object({}),
	handler,
};
