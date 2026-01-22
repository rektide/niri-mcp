import { z } from "zod";

export const ConfigStateSchema = z.enum(["included", "excluded"]);
export type ConfigState = z.infer<typeof ConfigStateSchema>;

export const ToggleActionSchema = z.enum(["on", "off", "toggle"]);
export type ToggleAction = z.infer<typeof ToggleActionSchema>;

export const ConfigFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  state: ConfigStateSchema,
  size: z.number().optional(),
});
export type ConfigFile = z.infer<typeof ConfigFileSchema>;

export const ConfigFileResultSchema = z.object({
  name: z.string(),
  previousState: ConfigStateSchema,
  newState: ConfigStateSchema,
  path: z.string(),
});
export type ConfigFileResult = z.infer<typeof ConfigFileResultSchema>;

export const SkippedFileSchema = z.object({
  name: z.string(),
  reason: z.string(),
});
export type SkippedFile = z.infer<typeof SkippedFileSchema>;

export const ToggleResultSchema = z.object({
  affected: z.array(ConfigFileResultSchema),
  skipped: z.array(SkippedFileSchema),
});
export type ToggleResult = z.infer<typeof ToggleResultSchema>;
