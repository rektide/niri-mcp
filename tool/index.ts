import { tools as msgTool } from "./msg/index.ts";
import { tool as listConfigTool } from "./config/list.ts";
import type { ToolDefinition } from "../types.d.ts";

export const tools: ToolDefinition[] = [...msgTool, listConfigTool];

export * from "./msg/index.ts";
