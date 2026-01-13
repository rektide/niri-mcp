import { z } from "zod";

export const OutputModeSchema = z.object({
	width: z.number(),
	height: z.number(),
	refresh_rate: z.number(),
	is_preferred: z.boolean(),
});

export const OutputLogicalSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	scale: z.number(),
	transform: z.enum([
		"Normal",
		"90",
		"180",
		"270",
		"Flipped",
		"Flipped-90",
		"Flipped-180",
		"Flipped-270",
	]),
});

export const OutputSchema = z.object({
	name: z.string(),
	make: z.string().nullable(),
	model: z.string(),
	serial: z.string().nullable(),
	physical_size: z.tuple([z.number(), z.number()]),
	modes: z.array(OutputModeSchema),
	current_mode: z.number(),
	is_custom_mode: z.boolean(),
	vrr_supported: z.boolean(),
	vrr_enabled: z.boolean(),
	logical: OutputLogicalSchema,
});

export const WorkspaceSchema = z.object({
	id: z.number(),
	idx: z.number(),
	name: z.string().nullable(),
	output: z.string(),
	is_urgent: z.boolean(),
	is_active: z.boolean(),
	is_focused: z.boolean(),
	active_window_id: z.number().nullable(),
});

export const WindowLayoutSchema = z.object({
	pos_in_scrolling_layout: z.tuple([z.number(), z.number()]),
	tile_size: z.tuple([z.number(), z.number()]),
	window_size: z.tuple([z.number(), z.number()]),
	tile_pos_in_workspace_view: z.nullable(z.tuple([z.number(), z.number()])),
	window_offset_in_tile: z.tuple([z.number(), z.number()]),
});

export const FocusTimestampSchema = z.object({
	secs: z.number(),
	nanos: z.number(),
});

export const WindowSchema = z.object({
	id: z.number(),
	title: z.string(),
	app_id: z.string(),
	pid: z.number(),
	workspace_id: z.number(),
	is_focused: z.boolean(),
	is_floating: z.boolean(),
	is_urgent: z.boolean(),
	layout: WindowLayoutSchema,
	focus_timestamp: FocusTimestampSchema,
});

export const KeyboardLayoutsSchema = z.object({
	names: z.array(z.string()),
	current_idx: z.number(),
});

export const OverviewStateSchema = z.object({
	is_open: z.boolean(),
});

export type OutputMode = z.infer<typeof OutputModeSchema>;
export type OutputLogical = z.infer<typeof OutputLogicalSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WindowLayout = z.infer<typeof WindowLayoutSchema>;
export type FocusTimestamp = z.infer<typeof FocusTimestampSchema>;
export type Window = z.infer<typeof WindowSchema>;
export type KeyboardLayouts = z.infer<typeof KeyboardLayoutsSchema>;
export type OverviewState = z.infer<typeof OverviewStateSchema>;
