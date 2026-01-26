import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
// import { parse, format } from "@bgotink/kdl";
import type { ToolDefinition } from "../../types.d.ts";

const DISABLED_COMMENT = "// disabled";

const inputSchema = z.object({
  pattern: z.string().optional(),
  action: z.enum(["on", "off", "toggle"]).default("toggle"),
});

async function handler() {
  const configPath = `${process.env.HOME}/.config/niri/config.kdl`;
  const pattern = undefined;
  const action = "toggle";

  try {
    let content = await readFile(configPath, "utf-8");
    const affected: Array<{ include: string; previousState: string; newState: string }> = [];
    const skipped: Array<{ include: string; reason: string }> = [];

    const lines = content.split("\n");
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("include")) {
        const match = pattern && !new RegExp(pattern).test(trimmed);
        if (match) {
          skipped.push({
            include: trimmed,
            reason: "Does not match pattern",
          });
          continue;
        }

        const hasDisabled = trimmed.includes(DISABLED_COMMENT);
        const previousState = hasDisabled ? "excluded" : "included";
        let newState: string;

        switch (action as "on" | "off" | "toggle") {
          case "on" as const:
            if (previousState === "excluded") {
              lines[i] = trimmed.replace(DISABLED_COMMENT, "").trimEnd();
              modified = true;
              newState = "included";
            }
            break;
          case "off" as const:
            if (previousState === "included") {
              lines[i] = `${trimmed} ${DISABLED_COMMENT}`;
              modified = true;
              newState = "excluded";
            }
            break;
          case "toggle" as const:
            if (hasDisabled) {
              lines[i] = trimmed.replace(DISABLED_COMMENT, "").trimEnd();
              newState = "included";
            } else {
              lines[i] = `${trimmed} ${DISABLED_COMMENT}`;
              newState = "excluded";
            }
            modified = true;
            break;
        }

        if (newState) {
          const includeValue = trimmed.split(/\s+/)[1];
          affected.push({
            include: includeValue,
            previousState,
            newState,
          });
        }
      }
    }

    if (modified) {
      await writeFile(configPath, lines.join("\n"), "utf-8");
    }

    const result = {
      affected,
      skipped,
    };

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
  name: "toggle_niri_kdl_include",
  description: "Toggle KDL include directives in niri config.kdl by adding/removing '// disabled' comment",
  inputSchema,
  handler,
};
