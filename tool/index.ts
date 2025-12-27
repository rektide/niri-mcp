import { tools as msgTool } from "./msg/index.ts";
import type { ToolDefinition } from "../types.d.ts";

export const tools: ToolDefinition[] = [...msgTool];

export * from "./msg/index.ts";
