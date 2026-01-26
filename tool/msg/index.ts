import * as outputs from "./outputs.ts";
import * as workspaces from "./workspaces.ts";
import * as windows from "./windows.ts";
import * as layers from "./layers.ts";
import * as keyboardLayouts from "./keyboard-layouts.ts";
import * as focusedOutput from "./focused-output.ts";
import * as focusedWindow from "./focused-window.ts";
import * as overviewState from "./overview-state.ts";
import type { ToolDefinition } from "../../types.d.ts";
export * from "./types.ts";

export {
	focusedOutput,
	focusedWindow,
	keyboardLayouts,
	layers,
	outputs,
	overviewState,
	windows,
	workspaces,
};

export const tools: ToolDefinition[] = [
	outputs.tool,
	workspaces.tool,
	windows.tool,
	layers.tool,
	keyboardLayouts.tool,
	focusedOutput.tool,
	focusedWindow.tool,
	overviewState.tool,
];
