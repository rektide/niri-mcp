import { z } from "zod";
import { rename } from "node:fs/promises";
import type { ToolDefinition } from "../../types.d.js";
import { scanConfigDir, determineConfigState } from "./scan.js";
import type { ConfigFile, ToggleResult, ConfigFileResult, SkippedFile, ConfigState, ToggleAction } from "./types.js";

const inputSchema = z.object({
  idRegex: z.string().optional(),
  action: z.enum(["on", "off", "toggle"]).default("toggle"),
});

async function handler() {
  const dirPath = `${process.env.HOME}/.config/niri/config.d`;
  const idRegex = undefined;
  const action = "toggle";

  let regexPattern: RegExp | undefined;
  if (idRegex) {
    try {
      regexPattern = new RegExp(idRegex);
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Invalid regex pattern: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  const configs = await scanConfigDir(dirPath);
  const affected: ConfigFileResult[] = [];
  const skipped: SkippedFile[] = [];

  for (const config of configs) {
    if (regexPattern && !regexPattern.test(config.name)) {
      continue;
    }

    const previousState = config.state;
    let newState: ConfigState | undefined;
    const isExcluded = config.state === "excluded";
    const isIncluded = config.state === "included";

    switch (action as ToggleAction) {
      case "on":
        if (isExcluded) {
          const newPath = config.path.replace(/\.disabled$/, "");
          try {
            await rename(config.path, newPath);
            newState = "included";
          } catch (error) {
            skipped.push({
              name: config.name,
              reason: (error as Error).message,
            });
          }
        }
        break;
      case "off":
        if (isIncluded) {
          const newPath = `${config.path}.disabled`;
          try {
            await rename(config.path, newPath);
            newState = "excluded";
          } catch (error) {
            skipped.push({
              name: config.name,
              reason: (error as Error).message,
            });
          }
        }
        break;
      case "toggle":
        if (isIncluded) {
          const newPath = `${config.path}.disabled`;
          try {
            await rename(config.path, newPath);
            newState = "excluded";
          } catch (error) {
            skipped.push({
              name: config.name,
              reason: (error as Error).message,
            });
          }
        } else {
          const newPath = config.path.replace(/\.disabled$/, "");
          try {
            await rename(config.path, newPath);
            newState = "included";
          } catch (error) {
            skipped.push({
              name: config.name,
              reason: (error as Error).message,
            });
          }
        }
        break;
    }

    if (newState) {
      affected.push({
        name: config.name,
        previousState,
        newState,
        path: config.path,
      });
    }
  }

  const result: ToggleResult = {
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
}

export const tool: ToolDefinition = {
  name: "toggle_niri_config",
  description: "Toggle niri config.d files (enable/disable)",
  inputSchema,
  handler,
};
