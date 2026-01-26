import { tools as msgTool } from "./msg/index.ts"
import { tool as listConfigTool } from "./config/list.ts"
import { tool as toggleConfigTool } from "./config/toggle.ts"
import type { ToolDefinition } from "../types.d.ts"

export const tools: ToolDefinition[] = [
	...msgTool,
	listConfigTool,
	toggleConfigTool,
]

export * from "./msg/index.ts"
