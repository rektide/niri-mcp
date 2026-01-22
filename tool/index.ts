import { tools as msgTool } from "./msg/index.js";
import { tool as listConfigTool } from "./config/list.js";
import { tool as toggleConfigTool } from "./config/toggle.js";
import type { ToolDefinition } from "../types.d.js";

export const tools: ToolDefinition[] = [...msgTool, listConfigTool, toggleConfigTool];

export * from "./msg/index.js";
