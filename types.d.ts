import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

export interface ToolDefinition<
	TInputSchema extends z.ZodType = z.ZodType,
> {
	name: string;
	description: string;
	inputSchema: TInputSchema;
	handler: () => Promise<CallToolResult>;
}
