# Work: Type Definitions & Resource Architecture

## API Usability

### Type-Safe Tool Handlers

All niri msg tools now return properly typed data, eliminating the need for clients to parse untyped JSON strings. Each tool handler imports TypeScript types directly:

```typescript
import type { Output, Workspace, Window } from "./types.js";

async function handler() {
  const { stdout } = await x("niri", ["msg", "--json", "outputs"]);
  const result = JSON.parse(stdout) as Record<string, Output>;
  // Result is now typed - editor IntelliSense, validation, refactoring support
}
```

**Usability benefits:**
- **Editor IntelliSense** - Auto-completion for all properties
- **Type safety** - Compile-time checking prevents invalid property access
- **Refactoring safety** - Property renamed? TypeScript catches all usages
- **Self-documenting** - Types serve as inline documentation
- **Filtering ready** - Types exported for use with `utils/filter.ts`

### Exported Type System

All types are re-exported from `tool/msg/index.ts`, making them available for filtering utilities and future features:

```typescript
export * from "./types.js";

// Available types:
// - OutputMode
// - OutputLogical
// - Output
// - Workspace
// - WindowLayout
// - FocusTimestamp
// - Window
// - KeyboardLayouts
// - OverviewState
```

**Usability for filtering:**
```typescript
import { Workspace, query } from "./index.js";

const workspaces: Workspace[] = [...];
const filtered = query(workspaces, {
  filter: [{ field: "output", operator: "eq", value: "DP-1" }],
  include: ["id", "name", "is_active"],
});
// Result is typed as Workspace[]
```

## Underlying Structure & Design

### Type Definition Pattern

**File:** `tool/msg/types.ts`

Pattern: Zod schema with `Schema` suffix → inferred TypeScript type without suffix

```typescript
export const OutputSchema = z.object({
  name: z.string(),
  make: z.string().nullable(),
  // ... more fields
});

export type Output = z.infer<typeof OutputSchema>;
```

**Why this pattern:**
1. **Name separation** - `OutputSchema` (Zod) vs `Output` (TypeScript) prevents conflicts
2. **Single source of truth** - Schema is primary, type is derived
3. **Runtime validation** - Zod schemas can validate incoming data if needed
4. **Infer-based** - TypeScript types automatically stay in sync with schemas

### Type Hierarchy

**Output hierarchy:**
```
OutputMode (display resolution)
  └─ OutputLogical (position, scale, transform)
      └─ Output (monitor with modes, VRR, logical properties)
```

**Window hierarchy:**
```
WindowLayout (tile positions, sizes)
  └─ FocusTimestamp (nanosecond precision)
      └─ Window (title, app_id, workspace_id, flags, layout)
```

**Workspace hierarchy:**
```
Workspace (flat structure with id, output, flags, active_window_id)
```

**Other types:**
```
KeyboardLayouts (names array, current_idx)
OverviewState (is_open boolean)
```

### Handler Structure

**Pattern:** Each tool in `tool/msg/` follows identical structure:

```typescript
import { x } from "tinyexec";
import { z } from "zod";
import type { ToolDefinition } from "../../types.d.ts";
import type { Output } from "./types.js";

async function handler() {
  const { stdout } = await x("niri", ["msg", "--json", "outputs"]);
  const result = JSON.parse(stdout) as Record<string, Output>;
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
  name: "niri_outputs",
  description: "List connected outputs (monitors) in Niri window manager",
  inputSchema: z.object({}),  // Empty schema = no params
  handler,
};
```

**Key design decisions:**
- **Type assertion** - `as Record<string, Output>` instead of inline `z.infer`
- **text content type** - Returns JSON string, follows MCP standard
- **Empty input schema** - All current tools take no parameters
- **const type** - `"text" as const` prevents widening to string

### MCP Compliance

Tools return standard MCP response format:

```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify(result, null, 2)
    }
  ]
}
```

This matches [MCP Tools Specification](https://modelcontextprotocol.io/docs/concepts/tools/) exactly.

## History

### Phase 1: Type Discovery & Schema Creation

1. **Ran niri msg commands** to capture actual JSON structure:
   - `niri msg --json outputs` - Object keyed by output name
   - `niri msg --json workspaces` - Array of workspace objects
   - `niri msg --json windows` - Array of window objects
   - `niri msg --json layers` - Empty array (no active layers)
   - `niri msg --json keyboard-layouts` - Object with names array and current_idx
   - `niri msg --json focused-output` - Single output object
   - `niri msg --json focused-window` - Single window object
   - `niri msg --json overview-state` - Object with is_open boolean

2. **Created `tool/msg/types.ts`** with Zod schemas:
   - `OutputModeSchema`, `OutputLogicalSchema`, `OutputSchema`
   - `WorkspaceSchema`, `WindowLayoutSchema`, `FocusTimestampSchema`, `WindowSchema`
   - `KeyboardLayoutsSchema`, `OverviewStateSchema`
   - Inferred TypeScript types: `OutputMode`, `Output`, `Workspace`, `Window`, etc.

3. **Fixed naming conflict** - User requested `Schema` suffix for Zod types:
   - Initial: `Output` (Zod) and `Output` (type) = conflict
   - Final: `OutputSchema` (Zod) and `Output` (type) = clean separation

### Phase 2: Handler Updates

Updated existing handlers to use imported types:

**File:** `tool/msg/outputs.ts:8`
```typescript
// Before:
const result = JSON.parse(stdout) as Record<string, z.infer<typeof Output>>;

// After:
import type { Output } from "./types.js";
const result = JSON.parse(stdout) as Record<string, Output>;
```

**File:** `tool/msg/workspaces.ts:8`
```typescript
// Before:
const result = JSON.parse(stdout) as z.infer<typeof Workspace>[];

// After:
import type { Workspace } from "./types.js";
const result = JSON.parse(stdout) as Workspace[];
```

**File:** `tool/msg/windows.ts:8`
```typescript
// Before:
const result = JSON.parse(stdout) as z.infer<typeof Window>[];

// After:
import type { Window } from "./types.js";
const result = JSON.parse(stdout) as Window[];
```

**File:** `tool/msg/layers.ts:8`
```typescript
// No type needed - returns unknown[]
// Kept for consistency:
const result = JSON.parse(stdout) as unknown[];
```

### Phase 3: New Tool Creation

Created 4 additional tool handlers for missing niri msg subcommands:

**File:** `tool/msg/keyboard-layouts.ts`
- Command: `niri msg --json keyboard-layouts`
- Type: `KeyboardLayouts` (names array, current_idx)
- Tool name: `niri_keyboard_layouts`

**File:** `tool/msg/focused-output.ts`
- Command: `niri msg --json focused-output`
- Type: `Output` (single output object)
- Tool name: `niri_focused_output`

**File:** `tool/msg/focused-window.ts`
- Command: `niri msg --json focused-window`
- Type: `Window` (single window object)
- Tool name: `niri_focused_window`

**File:** `tool/msg/overview-state.ts`
- Command: `niri msg --json overview-state`
- Type: `OverviewState` (is_open boolean)
- Tool name: `niri_overview_state`

**File:** `tool/msg/index.ts:4-20`
- Added imports for 4 new tool modules
- Added to `tools` array: `keyboardLayouts.tool`, `focusedOutput.tool`, `focusedWindow.tool`, `overviewState.tool`
- Added `export * from "./types.js"` to export all types

### Phase 4: Build Fixes & Validation

**Issue:** `utils/filter.ts:1` had `import type { z }` but used `z` as value in code.

**Fix:** Changed to `import { z } from "zod"` (line 1 of filter.ts)

**Validation:**
```bash
pnpm run check:ts  # Passed - tsgo succeeded
pnpm run build:ts  # Passed - tsdown built successfully
```

Build output: `dist/niri-mcp.mjs` (4.95 kB gzip: 1.16 kB, later 6.86 kB gzip: 1.66 kB after type exports)

### Phase 5: Resource Architecture Planning

**File:** `doc/adr/01-resourcefulness.md` (new)

Created comprehensive Architectural Decision Record for implementing proper MCP resources:

**Decision summary:**
- Replace text-based tool returns with embedded resources using `type: "resource"`
- Implement hierarchical `niri://{niri-name}/` URI structure
- Support multiple niri instances via root `{niri-name}` component
- Add resource annotations (audience, priority, lastModified)
- Implement collection resources with `?expand` query parameter
- Integrate existing `utils/filter.ts` for `?fields=` and `?filter=`

**URI hierarchy proposed:**
```
niri://{niri-name}/
├── outputs/{name}/workspaces/{id}/windows/{id}/
├── windows/
├── layers/
├── keyboard-layouts/
└── overview-state/
```

**Implementation plan (5 phases):**
1. Core infrastructure (URI parser, resource registry)
2. Collection resources (root collections)
3. Hierarchical resources (output-scoped, workspace-scoped)
4. Filtering & selection (integrate filter utilities)
5. Advanced features (subscriptions, notifications)

**Not implemented yet** - ADR is planning document only.

## Next Steps

Based on ADR-001, next work would be:

1. **Implement resource infrastructure (see ADR-001)**
2. **Implement event streaming via Streamable HTTP (see ADR-003)**

2. **Implement `resources/list` and `resources/read`** MCP methods

3. **Implement collection resources** starting with root collections

4. **Phase out tools** (optional) or maintain dual approach

## Key Files

### Modified
- `tool/msg/types.ts` - Created (97 lines)
- `tool/msg/outputs.ts` - Updated to use `Output` type
- `tool/msg/workspaces.ts` - Updated to use `Workspace` type
- `tool/msg/windows.ts` - Updated to use `Window` type
- `tool/msg/layers.ts` - No type needed, consistent structure
- `tool/msg/index.ts` - Added 4 new tools, type exports
- `utils/filter.ts` - Fixed import (removed `type` keyword)

### Created
- `tool/msg/keyboard-layouts.ts` - New tool handler
- `tool/msg/focused-output.ts` - New tool handler
- `tool/msg/focused-window.ts` - New tool handler
- `tool/msg/overview-state.ts` - New tool handler
- `doc/adr/01-resourcefulness.md` - Architecture decision record (396 lines)

## Technical Decisions & Rationale

1. **Zod schemas with Schema suffix**
   - Why: Prevent naming conflicts with inferred types
   - Alternative: Separate files for schemas vs types (rejected - more maintenance)

2. **Import types instead of inline infer**
   - Why: Centralizes type definitions, enables re-export
   - User preference: Explicit request to avoid inline `z.infer`

3. **Export all types from index.ts**
   - Why: Enable use in filtering utilities and future features
   - Benefit: Single import point for all niri types

4. **Use text content type (not structured)**
   - Why: Matches existing MCP pattern, simpler
   - Future: ADR proposes embedded resources for structured content

5. **Include niri-name in URI path**
   - Why: Support multiple niri instances (work/play, user-specific)
   - User request: Explicit addition to ADR
   - Pattern: `niri://{niri-name}/outputs/DP-1/workspaces/1`

6. **Fix utils/filter.ts import**
   - Why: `import type { z }` cannot be used as value
   - Fix: Remove `type` keyword from import
