import * as outputs from "./outputs.ts";
import * as workspaces from "./workspaces.ts";
import * as windows from "./windows.ts";
import * as layers from "./layers.ts";
import type { ToolDefinition } from "../../types.d.ts";

export { outputs, workspaces, windows, layers };

export const tools: ToolDefinition[] = [
	outputs.tool,
	workspaces.tool,
	windows.tool,
	layers.tool,
];
