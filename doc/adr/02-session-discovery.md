# ADR-002: Session Discovery for User Login Sessions

## Status

Proposed

## Context

The niri-mcp server currently has no mechanism to discover which user sessions are running on the system, nor can it identify the window manager or display server for each session. This information is critical for several use cases:

1. **Multi-session awareness** - On systems with multiple user sessions (e.g., multiple TTYs, remote sessions), the MCP server needs to understand which sessions are actively running niri
2. **Display server detection** - Need to distinguish between Wayland (niri), X11 (Xorg/Xwayland), or other compositors
3. **Targeting operations** - Tools like `niri msg` need to target the correct session, which may require environment or session-specific context
4. **System integration** - Other MCP servers or tools may need to query active sessions for coordination

Currently, the niri-mcp server assumes a single niri session running in the user's environment. This assumption breaks in multi-session scenarios and provides no discoverability for clients to understand the system's session state.

Manual investigation using `loginctl` reveals session information is available:

```
SESSION  UID USER    SEAT  LEADER CLASS   TTY  IDLE SINCE
      1 1000 rektide -     905    manager -    no   -
      3 1000 rektide seat0 2326   user    tty2 no   -
```

And process inspection can identify the display server:
- `/usr/bin/niri --session` (Wayland compositor)
- `/usr/bin/Xwayland :0` (X11 compatibility layer)
- Other compositors like `gnome-shell`, `kwin`, `sway`, etc.

However, this information is not programmatically accessible through niri-mcp's current interface.

## Decision

We will implement a session discovery mechanism that:

1. **Uses `loginctl`** as the primary source of truth for session enumeration
2. **Inspects process trees** to identify the display server/window manager for each session
3. **Exposes session information** as an MCP tool providing structured data
4. **Caches session state** to avoid repeated expensive process tree traversal

### Technical Approach

#### Phase 1: Session Enumeration

Create a tool `list_sessions` that queries `loginctl`:

```bash
loginctl list-sessions --no-legend
```

For each session ID, fetch detailed properties:

```bash
loginctl show-session <id> -p Type -p Class -p Leader -p TTY -p Display -p Remote -p Service
```

#### Phase 2: Display Server Detection

For each session, identify the display server by:

1. **Get session PIDs** - `loginctl show-session <id> -p Pids` (may not work due to missing permissions)
2. **Process tree inspection** - Starting from the leader PID, recursively traverse children looking for known display servers:
   - Wayland compositors: `niri`, `gnome-shell`, `kwin`, `sway`, `weston`, `labwc`
   - X servers: `Xorg`, `Xwayland`, `Xephyr`
   - Session managers: `gdm-session-worker`, `lightdm`

3. **Process command line parsing** - Extract binary name and arguments:
   ```typescript
   const cmd = process.cmd.split(' ')[0];
   const name = cmd.split('/').pop();
   ```

#### Phase 3: MCP Tool Interface

Create an MCP tool `list_sessions` returning:

```typescript
{
  sessions: SessionInfo[]
}

interface SessionInfo {
  id: number;
  user: string;
  uid: number;
  seat: string | null;
  leader: number;
  class: "manager" | "user" | "greeter";
  type: "tty" | "x11" | "wayland" | "unspecified";
  tty: string | null;
  display: string | null;
  remote: boolean;
  service: string | null;
  displayServer: DisplayServerInfo | null;
  idle: boolean;
}

interface DisplayServerInfo {
  name: "niri" | "gnome-shell" | "kwin" | "sway" | "Xorg" | "Xwayland" | "other";
  pid: number;
  cmd: string;
  args: string[];
  sessionType: "wayland" | "x11" | "unknown";
}
```

#### Phase 4: Caching Strategy

- Cache session data for 5 seconds to avoid hammering `loginctl` and process inspection
- Cache invalidates on explicit `refresh_sessions` call or via TTL expiration
- Implement simple in-memory cache (no persistence needed)

### Implementation Location

Create `tool/msg/sessions.ts` with:
- `listSessions()` - Main session discovery logic
- `identifyDisplayServer(pid: number)` - Process tree inspection
- Session cache implementation

### File Structure

```
tool/
├── msg/
│   ├── sessions.ts          # New: Session discovery
│   ├── ...
tool/index.ts                # Register list_sessions tool
```

### Tool Handler Example

```typescript
export const listSessions: Tool = {
  name: "list_sessions",
  description: "List all user login sessions with display server information",
  inputSchema: {
    type: "object",
    properties: {
      refresh: {
        type: "boolean",
        description: "Force cache refresh"
      }
    }
  },
  async handler(args) {
    const sessions = await listSessions(args?.refresh);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(sessions, null, 2)
      }]
    };
  }
};
```

### Command Execution Strategy

For `loginctl` commands, use the existing `x()` helper from `niri-mcp.ts`:

```typescript
import { x } from '../niri-mcp';

async function getSessionProperties(id: number) {
  const stdout = await x("loginctl", ["show-session", String(id), "-p", "Type", "-p", "Class", "-p", "Leader"]);
  return parseProperties(stdout);
}
```

For process inspection, use `node:fs` to read `/proc/<pid>/cmdline`:

```typescript
import { readFileSync } from "node:fs";

function getProcessCmdline(pid: number): string {
  const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf-8");
  return cmdline.replace(/\0/g, " ");
}
```

## Rationale

### Why `loginctl`?

1. **Systemd standard** - On modern Linux systems, `loginctl` is the authoritative source for session information
2. **Comprehensive** - Provides session metadata (type, class, TTY, display, remote status) unavailable elsewhere
3. **Stable API** - Well-documented interface with stable output format
4. **Widely available** - Installed by default on systems using systemd (most Linux distros)

### Why Process Tree Inspection?

1. **No native display server query** - `loginctl` doesn't directly report which WM/compositor is running
2. **Cross-platform approach** - Works for any compositor (niri, sway, gnome, etc.) without compositor-specific APIs
3. **Fallback-friendly** - If process inspection fails, session info is still useful without display server details
4. **Explicit detection** - Actually verifies which binary is running, not just inferring from session type

### Why Cache?

1. **Performance** - Process tree inspection is expensive; avoid on every call
2. **Rate limiting** - Prevent spamming `loginctl` and `/proc` reads
3. **Consistency** - Multiple queries in quick succession should return consistent results
4. **Balance** - 5-second TTL provides freshness without overhead

### Why Tool Not Resource?

1. **Dynamic data** - Sessions change (login/logout); caching required anyway
2. **Action-oriented** - Primary use case is querying current state, not subscribing to changes
3. **Simpler** - No need for resource URIs for entities that are transient
4. **Complementary** - Existing tools (workspaces, windows) remain tools; sessions follow same pattern

### Why Structured Return Type?

1. **Type safety** - Clients know exactly what fields to expect
2. **Discovery** - Clients can filter sessions by type, user, display server
3. **Future extension** - Easy to add fields (idle time, start time, etc.)
4. **MCP compatibility** - Matches existing tool output pattern

## Consequences

### Positive

1. **Multi-session support** - Can now handle systems with multiple concurrent sessions
2. **Display server awareness** - Clients can identify niri vs X11 vs Wayland sessions
3. **Better integration** - Other tools can query sessions to target the correct one
4. **System visibility** - Provides observability into login session state
5. **Extensible** - Pattern can be extended for other session-related queries

### Negative

1. **Platform dependency** - Requires systemd and `loginctl`; won't work on non-systemd systems (BSD, musl, etc.)
2. **Permission sensitivity** - May require elevated privileges for complete session info (Pids property)
3. **Process tree complexity** - Traversing process trees can be complex and error-prone
4. **Caching complexity** - Cache invalidation logic adds maintenance burden
5. **Code size** - Additional module increases bundle size

### Neutral

1. **Breaking changes** - None; new tool doesn't affect existing functionality
2. **Performance** - Initial query is slow; cached queries are fast
3. **Dependencies** - No new external dependencies; uses `loginctl` and `/proc`
4. **Testing** - Requires integration testing with actual `loginctl` and process trees

## Alternatives Considered

### Alternative 1: Use D-Bus Directly

**Proposal:** Query systemd-logind via D-Bus instead of `loginctl` CLI

**Rejected:** D-Bus interfaces are more complex; `loginctl` is simpler and provides same data with less code

### Alternative 2: Parse `/run/systemd/sessions/*`

**Proposal:** Read systemd session files directly from filesystem

**Rejected:** Implementation detail; `loginctl` is the stable public API, file format may change

### Alternative 3: Environment Variables Only

**Proposal:** Detect display server via `WAYLAND_DISPLAY` or `DISPLAY` environment variables

**Rejected:** Only works for current session; cannot enumerate other sessions or sessions with different environment

### Alternative 4: Resource-Based Approach

**Proposal:** Expose sessions as MCP resources (`session://1`, `session://3`) with `resources/list` and `resources/read`

**Rejected:** Sessions are transient; resource URIs suggest stable entities that don't fit login/logout lifecycle

### Alternative 5: Skip Process Tree, Infer from Session Type

**Proposal:** Use `loginctl` session type (`wayland`, `x11`) without verifying which compositor is running

**Rejected:** Type is often "unspecified" and doesn't identify specific compositor (niri vs gnome-shell vs sway)

## Implementation Plan

### Phase 1: Core Session Enumeration
1. Create `tool/msg/sessions.ts` with session list handler
2. Implement `loginctl` parsing for session properties
3. Basic MCP tool registration and testing

### Phase 2: Display Server Detection
1. Implement process tree traversal from leader PID
2. Add display server identification logic
3. Test with niri, Xwayland, and edge cases

### Phase 3: Caching
1. Implement in-memory cache with 5-second TTL
2. Add `refresh` parameter to force cache invalidation
3. Test cache behavior and expiration

### Phase 4: Testing & Polish
1. Integration tests with actual loginctl output
2. Error handling for missing processes/permissions
3. Documentation and examples

### Phase 5: Integration (Future)
1. Add `niri_session` parameter to existing tools to target specific session
2. Consider adding `get_session` tool for individual session details
3. Explore session change notifications if supported by systemd

## References

- [loginctl man page](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html)
- [systemd-logind D-Bus API](https://www.freedesktop.org/software/systemd/man/latest/org.freedesktop.login1.html)
- [MCP Tools Specification](https://modelcontextprotocol.io/docs/concepts/tools/)
- [Architectural Decision Records](https://adr.github.io/)
- [ADR-001: Resourceful MCP Resources](./01-resourcefulness.md)
