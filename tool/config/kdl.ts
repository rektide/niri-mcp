import { z } from "zod";
import { readFile } from "node:fs/promises";
import { parse } from "@bgotink/kdl";
import type { ToolDefinition } from "../../types.d.js";

const DISABLED_COMMENT = "// disabled";

const inputSchema = z.object({
  path: z.string().optional(),
});

async function handler() {
  const configPath = `${process.env.HOME}/.config/niri/config.kdl`;

  try {
    const content = await readFile(configPath, "utf-8");
    const doc = parse(content, { filename: configPath });

    const result = {
      path: configPath,
      includes: [] as Array<{ path: string; state: "included" | "excluded" }>,
    };

    for (const node of doc.nodes) {
      const name = node.getName();

      if (name !== "include") {
        continue;
      }

      const valueArg = node.getArgument("value");
      if (!valueArg) {
        continue;
      }

      const includeValue = valueArg.type === "string" ? valueArg.value : String(valueArg.value);
      const nodeText = format(node);
      const hasDisabledComment = nodeText.includes(DISABLED_COMMENT);

      result.includes.push({
        path: includeValue,
        state: hasDisabledComment ? "excluded" : "included",
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Config file not found" }, null, 2),
          },
        ],
      };
    }
    throw error;
  }
}

export const tool: ToolDefinition = {
  name: "list_niri_kdl_includes",
  description: "List KDL include directives from niri config.kdl with state",
  inputSchema,
  handler,
};
