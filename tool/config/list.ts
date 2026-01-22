import { z } from "zod";
import type { ToolDefinition } from "../../types.d.js";
import { scanConfigDir } from "./scan.js";
import type { ConfigFile } from "./types.js";

const inputSchema = z.object({
  filter: z.string().optional(),
});

async function handler() {
  const dirPath = `${process.env.HOME}/.config/niri/config.d`;
  const configs = await scanConfigDir(dirPath);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(configs, null, 2),
      },
    ],
  };
}

export const tool: ToolDefinition = {
  name: "list_niri_configs",
  description: "List niri config.d files with their state (included/excluded)",
  inputSchema,
  handler,
};
