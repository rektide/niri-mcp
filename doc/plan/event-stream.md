# Plan: Event-Stream Tool for Niri MCP

## SHORT-NAME: EVENT-STREAM

## Context

niri compositor provides an `event-stream` command (`niri msg --json event-stream`) that continuously outputs JSON events representing state changes in the compositor:

```bash
$ niri msg --json event-stream
{"WorkspacesChanged":{"workspaces":[...]}}
{"WindowsChanged":{"windows":[...]}}
{"KeyboardLayoutsChanged":{"keyboard_layouts":{...}}}
{"OverviewOpenedOrClosed":{"is_open":false}}
{"ConfigLoaded":{"failed":false}}
```

This is an **infinite stream** - niri keeps outputting events as they occur in real-time.

MCP (Model Context Protocol) supports **streaming notifications** via Server-Sent Events (SSE) to provide real-time updates to clients while tools execute or as background notifications.

## Problem

Currently, niri-mcp has:
1. **Polling-based approach** - No way to get real-time updates
2. **Event wastage** - niri's event-stream outputs continuously but MCP server ignores it
3. **No filtering** - Clients can't specify which events they care about
4. **Limited observability** - No subscription mechanism for resource changes

## Research

### MCP Streaming & Notifications

From [MCP TypeScript SDK docs](https://github.com/modelcontextprotocol/typescript-sdk):

**Transport types:**
- **stdio** - Local process communication (current implementation)
- **Streamable HTTP** - Recommended for remote servers, supports SSE
- **Legacy HTTP+SSE** - Backwards compatible SSE transport

**Streaming pattern:**
- Primary result is still delivered as single complete response
- Auxiliary **notifications** provide real-time feedback during/after operation
- `sendNotification()` API available in request handlers for server-initiated notifications

**Key insight:** MCP streaming is designed for:
1. **Tool execution progress** - Notify client while tool processes
2. **Background state changes** - Notify client of resource changes, config updates, etc.
3. **Bidirectional communication** - Server can also request sampling/elicitation from client

### Server-Sent Events (SSE)

From [MCP streaming examples](https://github.com/microsoft/mcp-for-beginners/blob/main/03-GettingStarted/06-http-streaming/README.md):

**SSE format:**
```http
Content-Type: text/event-stream
Connection: keep-alive

event: info
data: Calculating: 7.0 mul 5.0

event: result
data: 35.0

event: progress
data: 50%
```

**Server-side SSE in MCP:**
- Stream established via GET request
- Server pushes events using `event:` and `data:` lines
- Client receives events continuously
- No JSON-RPC wrapper for SSE events (pure SSE format)

### Niri Event Types

From testing `niri msg --json event-stream`:

| Event Type | JSON Key | Payload | When Fires |
|------------|------------|---------|------------|
| WorkspacesChanged | `workspaces` | Array of Workspace objects | Workspace added/removed/changed |
| WindowsChanged | `windows` | Array of Window objects | Window opened/closed/moved/focused |
| KeyboardLayoutsChanged | `keyboard_layouts` | KeyboardLayouts object | Layout switched |
| OverviewOpenedOrClosed | `is_open` | Boolean | Overview mode toggled |
| ConfigLoaded | `failed` | Boolean | Config reloaded |

**Stream characteristics:**
- **Infinite** - No natural end, runs until niri stops or connection closed
- **Line-by-line JSON** - Each line is a complete JSON object
- **One event per line** - Single JSON root key = single event type
- **No heartbeat** - No keep-alive events (silence = no changes)

## Design

### SHORT-NAME: EVENT-TOOL

A new MCP tool: `niri_event_stream` that proxies niri's event stream to MCP clients using SSE, with configurable filtering.

### Tool Interface

```typescript
{
  name: "niri_event_stream",
  description: "Subscribe to niri event stream with optional filters",
  inputSchema: z.object({
    events: z.array(z.string()).optional().describe("Event types to subscribe to (e.g., ['WindowsChanged', 'WorkspacesChanged'])"),
    filters: z.array(z.object({
      field: z.string(),
      operator: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "startsWith", "endsWith"]),
      value: z.unknown(),
    })).optional().describe("Filter expressions for event payloads"),
  }),
  handler: async (params) => { ...SSE stream... }
}
```

### SHORT-NAME: SSE-BRIDGE

Component that bridges niri's stdout event stream to MCP SSE format.

**Architecture:**

```
niri msg --json event-stream (stdout)
         ↓
+--------------+--------------+
|  EVENT-BRIDGE | Subprocess  |
|   (spawn niri) |  - Parse JSON   |
|              |   - Filter events  |
|              |   - Emit SSE     |
+--------------+--------------+
         ↓
    MCP SSE stream (to client)
```

**Responsibilities:**
1. Spawn `niri msg --json event-stream` subprocess
2. Parse line-by-line JSON from stdout
3. Apply filter expressions (if provided)
4. Transform to SSE format (`event: <type>\ndata: <json>`)
5. Write to MCP response stream (text/event-stream)
6. Handle subprocess lifecycle (cleanup on disconnect/error)

### SHORT-NAME: EVENT-FILTER

Filter engine that applies expressions to event payloads.

**Filter expression:**
```typescript
{
  field: "output",        // JSON path or field name
  operator: "eq",         // Comparison operator
  value: "DP-1"           // Value to compare
}
```

**Field syntax:**
- **Dot notation**: `output` (top-level field)
- **Nested**: `layout.tile_size[0]` (array index)
- **Wildcard**: `*` (all fields - match any)

**Applied to:**
- Event payloads (e.g., `windows.workspaces[].output`)
- Event metadata (event type, timestamp if available)

**Examples:**
```typescript
// Only windows on DP-1
filters: [{ field: "output", operator: "eq", value: "DP-1" }]

// Only focused windows
filters: [{ field: "is_focused", operator: "eq", value: true }]

// Windows with "tmux" in title
filters: [{ field: "title", operator: "contains", value: "tmux" }]

// Complex: windows on DP-1 that are focused
filters: [
  { field: "output", operator: "eq", value: "DP-1" },
  { field: "is_focused", operator: "eq", value: true }
]
```

### SSE Event Format

**Mapping niri events to SSE:**

| Niri JSON Key | SSE Event Name | SSE Data |
|---------------|-----------------|------------|
| WorkspacesChanged | `workspaces_changed` | JSON of workspaces array |
| WindowsChanged | `windows_changed` | JSON of windows array |
| KeyboardLayoutsChanged | `keyboard_layouts_changed` | JSON of keyboard_layouts object |
| OverviewOpenedOrClosed | `overview_changed` | JSON of is_open boolean |
| ConfigLoaded | `config_loaded` | JSON of failed boolean |

**SSE output:**
```
event: windows_changed
data: {"windows":[...]}

event: workspaces_changed
data: {"workspaces":[...]}
```

**Event metadata (optional):**
```
event: windows_changed
data: {...}
id: evt-123456
retry: 1000
```

### SHORT-NAME: CLIENT-SUBSCRIPTION

Client-side subscription model.

**Subscribe:**
```typescript
const stream = await client.callTool("niri_event_stream", {
  events: ["WindowsChanged", "WorkspacesChanged"],
  filters: [{ field: "output", operator: "eq", value: "DP-1" }]
});

// Returns SSE stream
for await (const event of stream) {
  console.log(`Event: ${event.event}, Data: ${event.data}`);
}
```

**Unsubscribe:**
- Close SSE connection (HTTP client or abort controller)
- Server terminates niri subprocess
- Cleanup resources

### Concurrency Model

**Multiple subscribers:**
- Each tool call spawns **separate** niri subprocess
- Isolation: No shared state between subscribers
- Trade-off: Duplicate niri connections (acceptable for low subscriber count)

**Single subscriber (optimized):**
- Share single niri event-stream subprocess
- Multiplex events to multiple tool responses
- More complex: Requires event routing logic
- **Recommendation:** Start with separate, optimize if needed

## Implementation Plan

### Phase 1: Core Infrastructure

**File:** `tool/event-stream/bridge.ts`

1. Create `EventBridge` class:
   - Spawn niri subprocess: `x("niri", ["msg", "--json", "event-stream"])`
   - Read stdout line-by-line
   - Parse JSON (handle parse errors gracefully)
   - Apply filters (from tool params)
   - Convert to SSE format
   - Write to writable stream (MCP response)

2. Error handling:
   - Invalid JSON: Log warning, continue to next line
   - Niri exits: Clean up, notify client via SSE close
   - Client disconnect: Kill subprocess

3. Stream lifecycle:
   - Spawn: Start reading stdout
   - Active: Pump events through filters
   - Stop: Cleanup subprocess

### Phase 2: Filter Engine

**File:** `tool/event-stream/filter.ts`

1. Implement `applyFilters<T>(payload: T, filters: FilterExpr[]): boolean`
2. Support field access via dot notation and array indexing
3. Support operators: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `startsWith`, `endsWith`
4. Match existing `utils/filter.ts` pattern for consistency

### Phase 3: Tool Registration

**File:** `tool/event-stream/index.ts`

1. Define tool schema with Zod:
   ```typescript
   export const tool: ToolDefinition = {
     name: "niri_event_stream",
     description: "Subscribe to niri event stream with optional filters",
     inputSchema: z.object({
       events: z.array(z.enum([...EVENT_TYPES])).optional(),
       filters: z.array(FilterExprSchema).optional(),
     }),
     handler: eventStreamHandler,
   };
   ```

2. Implement handler:
   - Validate params
   - Create EventBridge instance
   - Return SSE stream (special return type for MCP tools)
   - Handle errors/exceptions

3. Register in main tool index

### Phase 4: Testing

**Test scenarios:**
1. **Basic stream:** No filters, all events
2. **Event filtering:** Subscribe to only WindowsChanged
3. **Field filtering:** Windows on specific output
4. **Complex filters:** Multiple filter expressions
5. **Error handling:** Invalid JSON, niri crash
6. **Disconnection:** Client disconnects mid-stream

**Test approach:**
- Spawn niri and trigger window changes
- Verify events appear in stream
- Verify filtering works
- Verify SSE format is correct

### Phase 5: Documentation & Examples

1. Update main README with EVENT-TOOL usage
2. Create example client code
3. Document available event types
4. Document filter syntax and examples
5. Add troubleshooting section

## Alternative Approaches

### Alternative 1: Polling-Based Tool

**Proposal:** `niri_poll_events` tool that repeatedly calls `niri msg` commands

**Rejected:**
- No real-time updates (poll interval delay)
- Resource intensive (repeated subprocess spawns)
- niri already provides event-stream (inefficient to ignore)

### Alternative 2: Resource Subscriptions

**Proposal:** Implement `resources/subscribe` with change notifications

**Rejected:**
- Complex: Requires tracking all resource state, detecting changes
- Out of scope: ADR-001 focuses on resource structure, not change detection
- niri event-stream is already perfect for this use case

### Alternative 3: Shared Subprocess (Multiplexing)

**Proposal:** Single niri event-stream for all tool subscriptions

**Rejected (initially):**
- Adds complexity (event routing, subscriber management)
- Early optimization: Start with simple isolated model
- Can revisit if performance issues arise

### Alternative 4: Stdio Transport (No HTTP/SSE)

**Proposal:** Keep current stdio transport, push events via JSON-RPC notifications

**Rejected:**
- Stdio doesn't natively support streaming responses
- Would require protocol extension or workarounds
- SSE is standard, well-documented in MCP

## Open Questions

1. **Stream termination:** How does client signal unsubscribe? (Answer: Close SSE connection)
2. **Backpressure:** What if client can't consume events fast enough? (Answer: Use Node.js backpressure handling)
3. **Reconnection:** Should client reconnect on dropped connection? (Answer: No, re-call tool)
4. **Event ordering:** Guaranteed order from niri? (Answer: Yes, stdout is ordered)
5. **Binary events:** Does niri stream any non-JSON events? (Answer: Unknown, assume no)

## Dependencies

**Existing:**
- `tinyexec` - Already used for subprocess management
- `zod` - For input schema validation
- `utils/filter.ts` - Reuse filter logic (or adapt)

**Potential new:**
- Node.js `Readable.from()` - For stream wrapping
- `AbortController` - For cleanup on disconnect
- No external libraries needed

## Success Criteria

- [ ] Tool `niri_event_stream` registered and callable
- [ ] SSE stream successfully returned to MCP client
- [ ] Event filtering works (event type and field filters)
- [ ] Multiple concurrent subscriptions work (isolated)
- [ ] Clean subprocess cleanup on disconnect/error
- [ ] Documentation and examples provided
- [ ] Tests pass basic and filter scenarios
- [ ] Type-safe (Zod schema, inferred types for events)

## Risks & Mitigations

**Risk 1: Niri subprocess orphaned**
- Mitigation: Track subprocess PID, kill on tool handler cleanup
- Abort signal on disconnect

**Risk 2: Memory leaks in SSE bridge**
- Mitigation: Clear event handlers, close streams in finally block
- Use Node.js proper stream lifecycle management

**Risk 3: JSON parsing blocks event stream**
- Mitigation: Async queue for parsing, don't block stdout reading
- Skip invalid lines with warning (continue processing)

**Risk 4: Client disconnects, stream continues**
- Mitigation: Detect SSE stream closed, kill niri subprocess immediately
- No keep-alive mechanism needed (niri doesn't send heartbeat)

## References

- [MCP TypeScript SDK - Transports](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/CLAUDE.md#transport-system)
- [MCP Streaming in HTTP](https://github.com/microsoft/mcp-for-beginners/blob/main/03-GettingStarted/06-http-streaming/README.md)
- [MCP Streaming Example](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/examples/README.md#run-backwards-compatible-sse-and-streamable-http-server)
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Niri source (event-stream impl)] - Need to find in source code
