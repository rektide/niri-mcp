# ADR-003: Event Stream via Streamable HTTP

## Status

Proposed

## Context

niri compositor provides real-time event streaming via `niri msg --json event-stream`, outputting line-by-line JSON events as state changes occur:

```json
{"WorkspacesChanged":{"workspaces":[...]}}
{"WindowsChanged":{"windows":[...]}}
{"KeyboardLayoutsChanged":{"keyboard_layouts":{...}}}
{"OverviewOpenedOrClosed":{"is_open":false}}
```

niri-mcp currently:
1. Uses stdio transport only
2. No mechanism to proxy niri's event stream to MCP clients
3. No filtering capabilities for event types or field expressions
4. Limited to request-response tool pattern (no real-time updates)

MCP SDK provides two HTTP transport options with SSE (Server-Sent Events) support:

1. **SSE (Legacy HTTP+SSE)** - Older, backwards-compatible
2. **Streamable HTTP** - Modern, recommended for remote servers

## Decision

Implement **Streamable HTTP transport** for niri-mcp, using SDK's `StreamableHttpServer` and SSE-based event proxying to deliver niri events to MCP clients with filtering support.

### Transport Choice: Streamable HTTP vs Legacy SSE

| Aspect | Legacy SSE | Streamable HTTP |
|---------|------------|------------------|
| SDK class | `SseServer` / `SseClient` | `StreamableHttpServer` / `StreamableHttpClient` |
| Protocol version | Older | 2025-11-25 |
| Session management | Manual | Built-in, in-memory store |
| Notification support | Basic SSE only | Enhanced, change notifications |
| Recommendation | Backwards compatibility | **Recommended for remote** |
| SDK source | `src/server/sse.ts` | `src/server/streamableHttp.ts` |

**Rationale:**
- Streamable HTTP is actively maintained and recommended
- Built-in session management and resumability (`Last-Event-ID`)
- Protocol version 2025-11-25 enables newer MCP features
- Better support for notification patterns and resource change tracking

**Conclusion:** Use `StreamableHttpServer` from SDK, not legacy `SseServer`.

### Architecture: Event-Stream Tool

```
MCP Client
     |
     |  JSON-RPC (niri_event_stream tool)
     |  events: ["WindowsChanged"], filters: [...]
     ↓
+----+-------------------+
|    NIRI-MCP SERVER   |
|  Streamable HTTP      |
|  (via SDK)            |
|  - Session management   |
|  - JSON-RPC handling  |
|  - SSE streaming      |
|  - sendNotification()   |
+----+-------------------+
     |
     ↓  SSE Stream (text/event-stream)
     |  event: windows_changed
     |  data: {...}
+----+-------------------+
     |
     ↓
  Event Bridge
  (spawn niri msg --json event-stream)
  - Parse JSON
  - Apply filters
  - Write SSE events
     ↓
  niri Subprocess
```

### Components

#### EVENT-TOOL

MCP tool interface for subscribing to niri events with filtering:

```typescript
{
  name: "niri_event_stream",
  description: "Subscribe to niri event stream with optional filters",
  inputSchema: z.object({
    events: z.array(z.enum(EVENT_TYPES)).optional(),
    filters: z.array(FilterExprSchema).optional(),
  }),
  handler: async (params, extra) => Promise<CallToolResult>
}
```

Key aspects:
- Returns SSE stream (special return type for MCP tools)
- Filters applied at server side (reduce bandwidth)
- Session-managed via SDK's built-in transport

#### EVENT-BRIDGE

Component bridging niri subprocess to SSE format:

```typescript
class EventBridge {
  private process: Subprocess;
  private filterEngine: EventFilter;
  private sseStream: WritableStream;

  async start(params: StreamParams) {
    this.process = spawn("niri", ["msg", "--json", "event-stream"]);
    this.filterEngine = new EventFilter(params.filters);
    this.sseStream = extra.sendNotification({
      method: "events/stream",
      params: { events: params.events }
    });

    // Parse line-by-line JSON, filter, write to SSE
  }

  stop() {
    this.process.kill();
    this.sseStream.close();
  }
}
```

#### EVENT-FILTER

Filter engine applying expressions to event payloads:

```typescript
function applyFilters<T>(payload: T, filters: FilterExpr[]): boolean {
  return filters.every(f => {
    const value = getFieldValue(payload, f.field);
    return compare(value, f.operator, f.value);
  });
}
```

#### SSE-BRIDGE

SSE formatting layer:

```typescript
function toSSEEvent(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
```

#### CLIENT-SUBSCRIPTION

Client-side subscription model for consuming events:

```typescript
const client = new StreamableHttpClient({ url: "http://localhost:3000/mcp" });

const stream = await client.callTool("niri_event_stream", {
  events: ["WindowsChanged", "WorkspacesChanged"],
  filters: [{ field: "output", operator: "eq", value: "DP-1" }]
});

// Returns SSE stream
for await (const event of stream) {
  console.log(`Event: ${event.event}, Data: ${event.data}`);
}
```

### Event Types Mapping

| Niri JSON Key | SSE Event Name | Description |
|---------------|-----------------|------------|
| WorkspacesChanged | `workspaces_changed` | Workspace array changed |
| WindowsChanged | `windows_changed` | Window array changed |
| KeyboardLayoutsChanged | `keyboard_layouts_changed` | Keyboard layouts changed |
| OverviewOpenedOrClosed | `overview_changed` | Overview state changed |
| ConfigLoaded | `config_loaded` | Config reloaded |

### SSE Format

**Standard SSE:**
```
event: windows_changed
data: {"windows":[...]}

event: workspaces_changed
data: {"workspaces":[...]}
```

**With metadata (optional):**
```
event: windows_changed
data: {"windows":[...]}
id: evt-123456
retry: 1000
```

### Notification Sending via sendNotification()

From SDK, `extra.sendNotification()` in tool handlers sends server-initiated notifications:

```typescript
async function handler(params, extra) {
  // Return SSE stream for this tool call
  const stream = extra.sendNotification({
    method: "events/stream",
    params: { events: params.events, filters: params.filters }
  });

  return {
    content: [{ type: "resource", resource: { uri: "...", ... } }]
  };
}
```

**Key capabilities:**
- Sends SSE-formatted events without JSON-RPC wrapper
- Streamed continuously, not single response
- Automatic session association
- Reusable across tool calls and background processes

## Rationale

### Why Streamable HTTP?

1. **Recommended transport** - SDK docs explicitly recommend for remote servers
2. **Modern protocol** - Uses protocol version 2025-11-25
3. **Built-in notifications** - `sendNotification()` designed for this use case
4. **Session management** - Automatic, resumable with `Last-Event-ID`
5. **Active maintenance** - Core transport, not legacy compatibility layer

### Why Proxying via Tool vs. Resources?

**Approach:** EVENT-TOOL with SSE return

**Pros:**
- Standard MCP tool pattern (clients know how to call)
- Explicit subscription control via parameters
- Server-side filtering (efficiency)
- Works alongside existing tools

**Cons:**
- Requires tool call per subscription (not pure resources)
- Uses notification stream, not resource URI

**Alternative considered:** Resource subscription via `resources/subscribe`
- Rejected: More complex, niri event-stream is already perfect for this
- Tool-based approach is simpler and fits MCP patterns

### Why Server-Side Filtering?

1. **Bandwidth efficiency** - Filter before sending to client
2. **Simplicity** - Client receives only what it requested
3. **Latency reduction** - No client-side parsing of full event arrays

**Filter types:**
- Event type: Subscribe to only `WindowsChanged` events
- Field expressions: `[{field: "output", operator: "eq", value: "DP-1"}]`
- Compound filters: Multiple filters AND'ed together

### Why Line-by-Line JSON Parsing?

Niri's event-stream outputs complete JSON objects, one per line:

```
{"WorkspacesChanged":{...}}\n
{"WindowsChanged":{...}}\n
```

**Strategy:**
- Read stdout as text stream
- Split by newlines
- Parse each line as JSON (skip invalid lines)
- Process asynchronously (don't block subprocess)

**Error handling:**
- Invalid JSON: Log warning, continue to next line
- Process exit: Close SSE stream, cleanup

## Consequences

### Positive

1. **Real-time updates** - Clients receive events as they occur
2. **Efficient filtering** - Server-side reduces bandwidth
3. **Standard MCP transport** - Uses recommended Streamable HTTP
4. **Session management** - Built-in resumability from SDK
5. **Explicit subscriptions** - Clear tool-based API
6. **Compatible with existing tools** - Doesn't replace current architecture

### Negative

1. **Transport complexity** - Need to adopt Streamable HTTP vs stdio
2. **SSE overhead** - Need to format niri events as SSE
3. **Subprocess management** - Lifecycle management for niri subprocess
4. **No resource URI** - Events delivered via notification stream, not resources
5. **Protocol version lock-in** - Must support 2025-11-25 features

### Neutral

1. **Backwards compatible** - Existing stdio tools continue to work
2. **Transport choice** - Could support both stdio and HTTP
3. **Scalability** - Can optimize subprocess sharing later if needed

## Implementation Plan

### Phase 1: Transport Migration

1. Update `niri-mcp.ts` to use `StreamableHttpServerTransport`
2. Update dependencies if needed (SDK may already be installed)
3. Maintain stdio transport (dual support during transition)
4. Test basic server connectivity with Streamable HttpClient

### Phase 2: Event Bridge

**File:** `tool/event-stream/bridge.ts`

1. Create `EventBridge` class:
   - Spawn `niri msg --json event-stream` subprocess
   - Read stdout line-by-line
   - Parse JSON with error handling
   - Apply filters using EVENT-FILTER
   - Write SSE events to `extra.sendNotification()` stream
   - Handle cleanup on stop/error

2. Implement SSE formatting:
   - Map niri event keys to SSE event names
   - Format as `event: <type>\ndata: <json>\n\n`
   - Support optional metadata (id, retry)

### Phase 3: Filter Engine

**File:** `tool/event-stream/filter.ts`

1. Implement `applyFilters<T>(payload: T, filters: FilterExpr[]): boolean`
2. Support field access via dot notation and array indexing
3. Support operators: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `startsWith`, `endsWith`
4. Reuse pattern from `utils/filter.ts` where compatible

### Phase 4: Tool Registration

**File:** `tool/event-stream/index.ts`

1. Define tool schema with Zod:
   ```typescript
   export const tool: ToolDefinition = {
     name: "niri_event_stream",
     description: "Subscribe to niri event stream with optional filters",
     inputSchema: z.object({
       events: z.array(z.enum(EVENT_TYPES)).optional(),
       filters: z.array(FilterExprSchema).optional(),
     }),
     handler: eventStreamHandler,
   };
   ```

2. Implement handler:
   - Validate params using Zod
   - Create EventBridge instance
   - Pass `extra.sendNotification()` for SSE stream
   - Handle errors/exceptions
   - Return success response with resource URI reference

3. Register in main server initialization

### Phase 5: Types & Exports

**File:** `tool/event-stream/types.ts`

1. Define `EVENT_TYPES` array:
   ```typescript
   export const EVENT_TYPES = [
     "WorkspacesChanged",
     "WindowsChanged",
     "KeyboardLayoutsChanged",
     "OverviewOpenedOrClosed",
     "ConfigLoaded",
   ] as const;
   ```

2. Define `FilterExprSchema`:
   ```typescript
   export const FilterExprSchema = z.object({
     field: z.string(),
     operator: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "startsWith", "endsWith"]),
     value: z.unknown(),
   });
   ```

3. Export all types for client usage

### Phase 6: Testing

**Test scenarios:**
1. **Basic subscription** - No filters, all events
2. **Event type filtering** - Subscribe to only WindowsChanged
3. **Field filtering** - Windows on specific output
4. **Complex filters** - Multiple filter expressions
5. **Error handling** - Invalid JSON, niri crash
6. **Disconnection** - Client disconnects mid-stream
7. **Concurrent subscriptions** - Multiple tool calls spawn multiple bridges
8. **Subprocess cleanup** - Verify niri processes killed on disconnect

**Test approach:**
- Spawn niri and trigger window changes
- Verify events appear in SSE stream
- Verify filtering works correctly
- Verify SSE format matches specification
- Verify cleanup works on disconnect

### Phase 7: Documentation

1. Update main README with EVENT-TOOL usage
2. Create example client code using `StreamableHttpClient`
3. Document available event types
4. Document filter syntax and examples
5. Document transport choice (Streamable HTTP vs SSE)
6. Add troubleshooting section

## Alternatives Considered

### Alternative 1: Polling Tool

**Proposal:** `niri_poll_events` tool that repeatedly calls `niri msg` commands

**Rejected:**
- No real-time updates (poll interval delay)
- Resource intensive (repeated subprocess spawns)
- niri already provides event-stream (inefficient to ignore)

### Alternative 2: Resource Subscriptions

**Proposal:** Implement `resources/subscribe` with change notifications

**Rejected:**
- Complex: Requires tracking all resource state, detecting changes
- Out of scope: ADR-001 focuses on resource structure
- niri event-stream is already perfect for this use case

### Alternative 3: Legacy SSE Transport

**Proposal:** Use `SseServer` from SDK instead of `StreamableHttpServer`

**Rejected:**
- Older, backwards-compatible only
- Not recommended for remote servers
- Missing modern session management features
- Less actively maintained

### Alternative 4: Shared Subprocess

**Proposal:** Single niri event-stream subprocess for all tool subscriptions

**Rejected (initially):**
- Adds complexity (event routing, subscriber management)
- Early optimization: Start with simple isolated model
- Can revisit if performance issues arise

## File Structure

```
tool/
├── event-stream/
│   ├── index.ts              # Tool registration and handler
│   ├── types.ts              # EVENT_TYPES, FilterExprSchema, etc.
│   ├── bridge.ts             # EventBridge class (niri → SSE)
│   ├── filter.ts             # Filter engine (applyFilters function)
│   └── sse-formatter.ts      # SSE formatting utilities
tool/msg/                         # Keep existing stdio tools
```

## API Usage

### Server Setup

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHttpServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const transport = new StreamableHttpServerTransport({
  endpoint: "/mcp",
});

const server = new McpServer({
  name: "niri-mcp",
  version: "1.0.0",
});

// Register tools, resources
// ...

await server.connect(transport);
```

### Client Usage

```typescript
import { StreamableHttpClient } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new StreamableHttpClient({
  url: "http://localhost:3000/mcp"
});

// Subscribe to events
const stream = await client.callTool("niri_event_stream", {
  events: ["WindowsChanged"],
  filters: [{ field: "output", operator: "eq", value: "DP-1" }]
});

// Consume SSE events
for await (const event of stream) {
  console.log(`${event.event}: ${event.data}`);
}

// Unsubscribe (close connection or stop client)
```

## Success Criteria

- [ ] `StreamableHttpServerTransport` implemented and working
- [ ] EventBridge class parses niri events and filters correctly
- [ ] SSE formatting matches specification (event: / data:)
- [ ] `niri_event_stream` tool registered and callable
- [ ] Server-side filtering reduces bandwidth (verified)
- [ ] Multiple concurrent subscriptions work (isolated)
- [ ] Subprocess cleanup on disconnect/error works
- [ ] Documentation and examples provided
- [ ] Tests pass basic and filter scenarios
- [ ] Type-safe (Zod schemas, inferred types)

## Risks & Mitigations

**Risk 1: Niri subprocess orphaned**
- Mitigation: Track subprocess PID, kill in finally block
- Use AbortController for cancellation

**Risk 2: Memory leaks in Event Bridge**
- Mitigation: Clear event handlers, close streams properly
- Use finally blocks for cleanup

**Risk 3: JSON parsing blocks SSE stream**
- Mitigation: Async queue for parsing, non-blocking stdout reading
- Skip invalid lines with warning (continue processing)

**Risk 4: Client disconnects, stream continues**
- Mitigation: Detect SSE stream closed, kill niri subprocess immediately
- No keep-alive from niri (don't expect heartbeats)

**Risk 5: Protocol version compatibility**
- Mitigation: Use Streamable HTTP (recommended), keep stdio for fallback
- Document transport requirements clearly

## References

- [MCP Transport System](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/CLAUDE.md#transport-system)
- [Streamable HTTP Transport](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md#transports--streamable-http)
- [Streamable HTTP Server Notifications](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/examples/README.md#server-implementations--single-node-deployment--streamable-http-transport--streamable-http-with-server-notifications)
- [Request Handler Extra](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/CLAUDE.md#request-handler-extra)
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Niri event-stream command](https://github.com/YaLTeR/niri) - Source code for reference
