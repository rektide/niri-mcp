# ADR-004: Config.d Management

## Status

Proposed

## Context

Niri supports splitting configuration into multiple files in `~/.config/niri/config.d/`. Each file contains niri configuration (binds, rules, layouts, etc.) and is loaded at niri startup. This enables:
- Profile-based configs (work, play, personal)
- Feature toggles (experimental keybindings, layouts)
- Modular configuration organization
- Easy config testing and iteration

**Current niri-mcp state:**
- No tools for listing or managing config.d files
- Manual process: edit files directly, rename to `.disabled`, or comment lines
- Ticket `ncp-a51` exists for "Implement config block management tool" but is undefined
- Limited to request-response pattern, no config management capabilities

**Common patterns for config toggling:**
1. **File suffix** - Add `.disabled` to filename to exclude
2. **File prefix** - Add `_` or `.` prefix to exclude
3. **Content commenting** - Comment out all lines in file

**Adopted pattern:** File suffix `.disabled` (reversible, clear, standard practice)

## Decision

Implement config.d management tools for niri-mcp to enable listing and toggling config files via MCP.

### Tools

#### LIST-CONFIGS

Tool for scanning and listing config files with optional filtering:

```typescript
{
  name: "list_niri_configs",
  description: "List niri config.d files with their state (included/excluded)",
  inputSchema: z.object({
    filter: z.string().optional(),
  }),
  handler: async (params) => Promise<CallToolResult>
}
```

**Parameters:**
- `filter` (optional): Regex pattern to match filenames (e.g., `work-.*`, `experimental-.*`)

**Returns:**
```typescript
{
  configs: Array<{
    name: string,        // filename without path
    path: string,        // full path to file
    state: "included"|"excluded",
    size?: number        // file size in bytes
  }>
}
```

**Behavior:**
- Scans `~/.config/niri/config.d/` directory
- Determines state based on `.disabled` suffix
- Applies filter regex to filename (not full path)
- Returns all configs sorted alphabetically

#### TOGGLE-CONFIG

Tool for enabling/disabling config files with optional batch operations:

```typescript
{
  name: "toggle_niri_config",
  description: "Toggle niri config.d files (enable/disable)",
  inputSchema: z.object({
    idRegex: z.string().optional(),
    action: z.enum(["on", "off", "toggle"]).default("toggle"),
  }),
  handler: async (params) => Promise<CallToolResult>
}
```

**Parameters:**
- `idRegex` (optional): Regex pattern to match filenames for batch operations. If not specified, matches all configs.
- `action` (default: "toggle"): Operation to perform:
  - `on`: Enable config (remove `.disabled` suffix)
  - `off`: Disable config (add `.disabled` suffix)
  - `toggle`: Flip state (add/remove `.disabled` suffix)

**Returns:**
```typescript
{
  affected: Array<{
    name: string,
    previousState: "included"|"excluded",
    newState: "included"|"excluded",
    path: string
  }>,
  skipped: Array<{
    name: string,
    reason: string
  }>
}
```

**Behavior:**
- Applies regex to filename (not full path)
- For each match, perform action based on current state
- `on`: Only acts on excluded files (adds `.disabled` → removes it)
- `off`: Only acts on included files (no `.disabled` → adds it)
- `toggle`: Flips all matched files
- Returns list of affected and skipped configs with reasons

### Architecture

```
MCP Client
     ↓ JSON-RPC
     ├─ list_niri_configs(filter?: string)
     └─ toggle_niri_config(idRegex?: string, action?: "on"|"off"|"toggle")
NIRI-MCP SERVER
     ↓
CONFIG-SCAN (scanConfigDir)
     ├─ read CONFIG-DIR (~/.config/niri/config.d/)
     ├─ determine CONFIG-STATE (has .disabled suffix?)
     ├─ apply CONFIG-FILTER regex (to filename only)
     └─ return ConfigFile[] or scan result
LIST-CONFIGS TOOL
     └─ calls CONFIG-SCAN, returns ConfigFile[]
TOGGLE-CONFIG TOOL
     ├─ calls CONFIG-SCAN to find matches
     ├─ for each match, rename file (add/remove .disabled)
     └─ returns affected/skipped results
```

### State Determination

**CONFIG-STATE is determined by `.disabled` suffix:**
- `~/.config/niri/config.d/work-keybinds.kdl` → **included**
- `~/.config/niri/config.d/experimental.kdl.disabled` → **excluded**

**Rationale:**
- Reversible (can add/remove suffix)
- Clear visual indicator
- Standard practice in config management
- No file parsing required (fast)

### File Naming and Regex

**Regex applies to filename only (not full path):**
- Pattern: `work-.*` matches `work-keybinds.kdl`, not full path
- Case-sensitive by default (standard regex behavior)
- Users can use `(?i)` flag for case-insensitive matching

**Examples:**
```typescript
// Enable all work-related configs
toggle_niri_config({ idRegex: "work-.*", action: "on" })

// Disable all experimental configs
toggle_niri_config({ idRegex: "experimental-.*", action: "off" })

// Toggle all configs
toggle_niri_config({ action: "toggle" })

// List only profile configs
list_niri_configs({ filter: "profile-.*" })
```

### Error Handling

**Error cases:**
1. **Directory not found** - Return empty list with warning
2. **Permission denied** - Return error with file path
3. **Invalid regex** - Return validation error
4. **Rename conflict** - If target filename exists, skip with reason
5. **No matches** - Return empty affected array (not error)

**Validation:**
- Ensure idRegex is valid regex before scanning
- Ensure action is valid enum value
- Check file permissions before rename operations

## Rationale

### Why Config.d Management Tools?

1. **Profile switching** - Enable work config, disable play config
2. **Feature toggles** - Quickly enable/disable experimental features
3. **Testing workflows** - Toggle configs to test different setups
4. **Inventory visibility** - See what configs exist and their state
5. **Remote management** - Manage configs via MCP without editing files directly

### Why File Suffix Instead of Prefix/Commenting?

**File suffix `.disabled`:**
- Pros: Reversible, clear indicator, no content parsing
- Cons: Longer filenames

**File prefix `_` or `.`:**
- Pros: Shorter filenames
- Cons: Hidden files, less clear state indication

**Content commenting:**
- Pros: File remains active location
- Cons: Requires parsing, harder to automate, unclear state

**Decision:** File suffix is best balance - clear, reversible, fast.

### Why Optional Batch Operations via Regex?

1. **Convenience** - Toggle all "work-*" configs at once
2. **Flexibility** - Selective operations without specifying each file
3. **Safety** - Can preview matches before acting via list
4. **Power users** - Complex patterns possible with regex

### Why Separate List and Toggle Tools?

1. **Single responsibility** - List is read-only, toggle modifies
2. **Idempotency** - List always safe, toggle has side effects
3. **Preview workflow** - List first to see what will be affected, then toggle
4. **Clear semantics** - "list" vs "toggle" is unambiguous

### Why Default Action is "toggle"?

1. **Safety** - Can't accidentally enable/disable everything wrong
2. **Flippable** - Reversible operation (on/off toggle back)
3. **Common use case** - Usually want to flip state, not force it
4. **Explicit control** - Still have on/off for deliberate actions

## Consequences

### Positive

1. **Easy profile switching** - Toggle work/play configs
2. **Feature toggles** - Enable/disable experimental features
3. **Remote management** - Manage configs without file editing
4. **Inventory visibility** - See all configs and their state
5. **Batch operations** - Regex-based bulk actions
6. **Idempotent toggles** - Reversible, safe operations

### Negative

1. **Requires niri restart** - Changes only apply on niri reload
2. **No live preview** - Can't test config without restarting niri
3. **Manual reload** - Users must trigger niri config reload
4. **File suffix adds length** - `.disabled` makes filenames longer

### Neutral

1. **Reversible** - Can undo any toggle operation
2. **No state persistence** - Config state is file-based (no separate tracking)
3. **Regex power** - Flexible filtering but requires regex knowledge
4. **Directory location** - Tied to `~/.config/niri/config.d/` (niri convention)

## Implementation Plan

### Phase 1: Types and Utilities

**File:** `tool/config/types.ts`

1. Define `ConfigState` enum: `included`, `excluded`
2. Define `ToggleAction` enum: `on`, `off`, `toggle`
3. Define `ConfigFile` type:
   ```typescript
   interface ConfigFile {
     name: string
     path: string
     state: ConfigState
     size?: number
   }
   ```
4. Define `ToggleResult` type:
   ```typescript
   interface ToggleResult {
     affected: Array<{
       name: string
       previousState: ConfigState
       newState: ConfigState
       path: string
     }>
     skipped: Array<{
       name: string
       reason: string
     }>
   }
   ```

### Phase 2: Directory Scanning

**File:** `tool/config/scan.ts`

1. Implement `scanConfigDir(dirPath: string, filter?: string): ConfigFile[]`
   - Read directory with `node:fs/promises.readdir()`
   - Filter regular files only (skip directories)
   - Determine state via `.disabled` suffix
   - Apply regex filter to filename (not full path)
   - Return sorted array

2. Implement `determineConfigState(filename: string): ConfigState`
   - Check for `.disabled` suffix
   - Return `included` or `excluded`

3. Implement `applyConfigFilter(filename: string, pattern?: string): boolean`
   - Test filename against regex pattern
   - Return true if matches or no pattern

### Phase 3: List Tool

**File:** `tool/config/list.ts`

1. Define tool schema with Zod:
   ```typescript
   export const tool: ToolDefinition = {
     name: "list_niri_configs",
     description: "List niri config.d files with their state",
     inputSchema: z.object({
       filter: z.string().optional(),
     }),
     handler: listConfigsHandler,
   };
   ```

2. Implement `listConfigsHandler()`:
   - Get `~/.config/niri/config.d/` path (use xdg-basedir or fallback)
   - Validate regex if filter provided
   - Call `scanConfigDir()`
   - Return configs array

### Phase 4: Toggle Tool

**File:** `tool/config/toggle.ts`

1. Define tool schema with Zod:
   ```typescript
   export const tool: ToolDefinition = {
     name: "toggle_niri_config",
     description: "Toggle niri config.d files (enable/disable)",
     inputSchema: z.object({
       idRegex: z.string().optional(),
       action: z.enum(["on", "off", "toggle"]).default("toggle"),
     }),
     handler: toggleConfigHandler,
   };
   ```

2. Implement `toggleConfigHandler()`:
   - Get config.d path
   - Validate regex if idRegex provided
   - Call `scanConfigDir()` to find matches
   - For each match, apply action:
     - `on`: Remove `.disabled` if present
     - `off`: Add `.disabled` if not present
     - `toggle`: Flip `.disabled` presence
   - Track affected and skipped configs
   - Return result with affected/skipped arrays

3. Implement `toggleConfigFile(configPath: string, action: ToggleAction): ConfigState`
   - Rename file based on action and current state
   - Handle rename conflicts (skip if target exists)
   - Return new state

### Phase 5: Testing

**Test scenarios:**
1. **List all configs** - No filter, return all files
2. **List with filter** - Regex matches subset of files
3. **Toggle single config** - Enable/disable specific file
4. **Toggle batch** - Regex matches multiple files
5. **Toggle on/off** - Force specific state
6. **Toggle toggle** - Flip all matched configs
7. **No matches** - Empty result, no error
8. **Directory not found** - Return empty with warning
9. **Permission error** - Return error with details
10. **Invalid regex** - Return validation error

**Test approach:**
- Mock file system for test isolation
- Create temp config.d directory with test files
- Verify file renames occur correctly
- Verify state determination works
- Verify regex filtering works
- Verify error handling covers edge cases

### Phase 6: Documentation

1. Update main README with LIST-CONFIGS and TOGGLE-CONFIG tools
2. Document config.d pattern and `.disabled` suffix
3. Provide usage examples for list and toggle
4. Document regex syntax and examples for batch operations
5. Add workflow examples (profile switching, feature toggles)
6. Document error handling and edge cases
7. Note that niri reload is required for changes to take effect

**Examples:**
```typescript
// List all configs
await client.callTool("list_niri_configs", {})

// List only work profiles
await client.callTool("list_niri_configs", { filter: "work-.*" })

// Enable work configs, disable play configs
await client.callTool("toggle_niri_config", { idRegex: "work-.*", action: "on" })
await client.callTool("toggle_niri_config", { idRegex: "play-.*", action: "off" })

// Toggle all experimental features
await client.callTool("toggle_niri_config", { idRegex: "experimental-.*", action: "toggle" })
```

## Alternatives Considered

### Alternative 1: Single Tool with Mode Parameter

**Proposal:** `manage_niri_config(mode: "list"|"toggle", ...)`

**Rejected:**
- Confusing API - tool name doesn't indicate operation
- Mixing read/write operations in single tool
- Less clear separation of concerns
- Violates single responsibility principle

### Alternative 2: Content Commenting

**Proposal:** Comment out all lines in file to disable

**Rejected:**
- Requires file parsing (KDL format)
- Harder to automate (need to parse comments)
- No clear visual indicator of state
- Slower (file I/O + parsing)

### Alternative 3: Separate Enable/Disable Tools

**Proposal:** `enable_niri_config()` and `disable_niri_config()` tools

**Rejected:**
- Redundant - `toggle_niri_config` with `on`/`off` is same
- More tool names to remember
- Less flexible (no toggle operation)

### Alternative 4: In-Memory State Tracking

**Proposal:** Track config state in separate file or database

**Rejected:**
- Adds complexity (state synchronization)
- Single source of truth should be file system
- Risk of drift between tracking and actual files
- File system state is sufficient

## File Structure

```
tool/
├── config/
│   ├── index.ts              # Tool registration and exports
│   ├── types.ts             # ConfigState, ToggleAction, ConfigFile, ToggleResult
│   ├── scan.ts              # scanConfigDir(), determineConfigState(), applyConfigFilter()
│   ├── list.ts              # LIST-CONFIGS tool definition and handler
│   └── toggle.ts            # TOGGLE-CONFIG tool definition and handler
tool/msg/                         # Keep existing stdio tools
```

## API Usage

### Server Setup

```typescript
import { list_niri_configs, toggle_niri_config } from './tool/config/index.js';

// Register tools
server.addTool(list_niri_configs);
server.addTool(toggle_niri_config);
```

### Client Usage

```typescript
// List all configs
const listResult = await client.callTool("list_niri_configs", {});
console.log(listResult.configs);
// [
//   { name: "work-keybinds.kdl", path: "...", state: "included" },
//   { name: "play-keybinds.kdl.disabled", path: "...", state: "excluded" }
// ]

// List with filter
const filtered = await client.callTool("list_niri_configs", { filter: "work-.*" });

// Toggle single config
const toggleResult = await client.callTool("toggle_niri_config", {
  idRegex: "work-keybinds\\.kdl",
  action: "toggle"
});
console.log(toggleResult.affected);
// [
//   { name: "work-keybinds.kdl", previousState: "included", newState: "excluded", path: "..." }
// ]

// Toggle batch
const batchResult = await client.callTool("toggle_niri_config", {
  idRegex: "experimental-.*",
  action: "off"
});
```

## Success Criteria

- [ ] `list_niri_configs` tool lists all config.d files with correct state
- [ ] `toggle_niri_config` tool enables/disables files correctly
- [ ] File renaming (add/remove `.disabled`) works correctly
- [ ] Regex filtering works for both list and toggle operations
- [ ] Batch operations (multiple files) work correctly
- [ ] Error handling covers all edge cases (directory not found, permissions, invalid regex)
- [ ] Tests pass for all scenarios
- [ ] Documentation includes examples and usage patterns
- [ ] Type-safe (Zod schemas, inferred types)

## Risks & Mitigations

**Risk 1: Race conditions with niri reload**
- Mitigation: Document that changes require niri restart, not our responsibility
- Users must trigger reload after toggling

**Risk 2: Rename conflicts during batch operations**
- Mitigation: Check if target filename exists before rename, skip with reason
- Return skipped files in result so user knows what happened

**Risk 3: Invalid regex causes crashes**
- Mitigation: Validate regex with `new RegExp()` before scanning
- Catch syntax errors and return clear error message

**Risk 4: Permission denied on config.d directory**
- Mitigation: Catch permission errors, return error with file path
- Check directory read/write permissions before operations

**Risk 5: File not found during rename (race condition)**
- Mitigation: Use atomic rename operations, catch ENOENT errors
- Skip file if not found, include in skipped array with reason

## References

- [Niri Config Documentation](https://github.com/YaLTeR/niri/wiki) - Config file structure and config.d usage
- [KDL Language](https://kdl.dev/) - Configuration language used by niri
- [MCP Tool Schema](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/CLAUDE.md#tool-definition) - Tool input/output schemas
- [Node.js File System](https://nodejs.org/api/fs.html) - File system operations
