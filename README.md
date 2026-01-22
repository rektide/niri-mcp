# niri-mcp

Model Context Protocol (MCP) server for the Niri window manager.

## Tools

### Query Tools

- `niri_outputs` - List connected outputs (monitors)
- `niri_workspaces` - List workspaces
- `niri_windows` - List windows
- `niri_layers` - List layers
- `niri_keyboard_layouts` - List keyboard layouts
- `niri_focused_output` - Show currently focused output
- `niri_focused_window` - Show currently focused window
- `niri_overview_state` - Show current overview state

### Config.d Management Tools

- `list_niri_configs` - List niri config.d files with their state
- `toggle_niri_config` - Enable/disable niri config.d files

#### list_niri_configs

List all configuration files in `~/.config/niri/config.d/` with their state (included or excluded).

**Parameters:**
- `filter` (optional, string): Regex pattern to match filenames

**Returns:** Array of config files with `name`, `path`, `state`, and `size`.

**Example:**
```typescript
// List all configs
await client.callTool("list_niri_configs", {})

// List only work profile configs
await client.callTool("list_niri_configs", { filter: "work-.*" })
```

#### toggle_niri_config

Enable or disable config files by adding/removing the `.disabled` suffix.

**Parameters:**
- `idRegex` (optional, string): Regex pattern to match filenames for batch operations. Defaults to all configs.
- `action` (optional, string): Operation to perform - `"on"` (enable), `"off"` (disable), or `"toggle"` (flip state). Defaults to `"toggle"`.

**Returns:** Object with `affected` array and `skipped` array.

**Example:**
```typescript
// Enable work configs
await client.callTool("toggle_niri_config", { idRegex: "work-.*", action: "on" })

// Disable play configs
await client.callTool("toggle_niri_config", { idRegex: "play-.*", action: "off" })

// Toggle all experimental features
await client.callTool("toggle_niri_config", { idRegex: "experimental-.*", action: "toggle" })

// Toggle all configs
await client.callTool("toggle_niri_config", { action: "toggle" })
```

#### Config State

Config file state is determined by the `.disabled` suffix:
- `included` - File is active (no `.disabled` suffix)
- `excluded` - File is disabled (has `.disabled` suffix)

**Note:** Changes to config.d files require niri restart or config reload to take effect. This is a niri limitation, not specific to niri-mcp.

#### Workflow Examples

**Profile Switching:**
```typescript
// Switch to work profile
await client.callTool("toggle_niri_config", { idRegex: "work-.*", action: "on" })
await client.callTool("toggle_niri_config", { idRegex: "play-.*", action: "off" })
await client.callTool("toggle_niri_config", { idRegex: "personal-.*", action: "off" })
// Then trigger niri config reload or restart niri
```

**Feature Toggles:**
```typescript
// Enable experimental feature
await client.callTool("toggle_niri_config", { idRegex: "experimental-.*", action: "on" })

// Check current state
const result = await client.callTool("list_niri_configs", {})
console.log(result.configs)
```

**Troubleshooting:**

- **niri not running:** Config tools will work but changes won't take effect until niri is started
- **Permission denied:** Check that your user has read/write access to `~/.config/niri/config.d/`
- **Regex not matching:** Ensure regex syntax is correct and matches filenames (not full paths)
- **File not found:** Ensure config.d directory exists at `~/.config/niri/config.d/`
