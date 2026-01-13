# ADR-001: Resourceful MCP Resources with Embedded Content and Hierarchical URIs

## Status

Accepted

## Context

The niri-mcp server currently exposes niri window manager data through MCP tools that return unstructured JSON text content. While functional, this approach has several limitations:

1. **No resource hierarchy** - All data is flat, with no representation of relationships (e.g., workspaces belong to outputs)
2. **No structured content** - Tools only return `text` content with JSON.stringify, requiring clients to parse strings
3. **No resource URIs** - No stable identifiers for entities, making subscriptions and references impossible
4. **Limited discoverability** - Clients must understand tool output structure through external documentation
5. **Missing MCP capabilities** - Not leveraging MCP's resource features like embedded resources, annotations, or subscriptions

The current tool handlers return:
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

## Decision

We will implement proper MCP resources with:

1. **Embedded resources** using `type: "resource"` content items with structured JSON data
2. **Hierarchical URI structure** reflecting entity relationships using `niri://` scheme
3. **Resource annotations** for audience and priority hints
4. **Comprehensive resource listing** and retrieval capabilities
5. **Proper MIME types** for structured data (e.g., `application/json+schema`)

### URI Hierarchy

Resources will follow a hierarchical structure reflecting niri's domain model:

```
niri://
├── outputs/                          # All outputs
│   ├── {name}/                       # Specific output
│   │   └── workspaces/              # Workspaces on this output
│   │       ├── {id}/                  # Specific workspace
│   │       │   └── windows/          # Windows in this workspace
│   │       │       ├── {id}/          # Specific window
│   │       │       └──              # List of windows
│   │       └──                      # List of workspaces
│   └── modes/                      # Output modes (alternative)
├── windows/                          # All windows (cross-output view)
│   └── {id}/                       # Specific window
├── layers/                           # Layer-shell surfaces
│   └── {id}/                       # Specific layer
├── keyboard-layouts/                 # Keyboard layouts
│   └── current/                     # Current layout
└── overview-state/                  # Overview toggle state
```

### Embedded Resource Structure

Resources will return embedded resources for structured data:

```typescript
{
  content: [
    {
      type: "resource",
      resource: {
        uri: "niri://outputs/DP-1",
        mimeType: "application/json+schema",
        text: JSON.stringify(outputData, null, 2),
        annotations: {
          audience: ["assistant", "user"],
          priority: 1.0
        }
      }
    }
  ]
}
```

### Resource Type Mapping

| Niri Entity | Resource URI Pattern | MIME Type | Content Type |
|-------------|-------------------|------------|--------------|
| Output | `niri://outputs/{name}` | `application/json+schema` | Embedded resource |
| Output modes | `niri://outputs/{name}/modes` | `application/json+schema` | Embedded resource |
| Workspaces (output-scoped) | `niri://outputs/{name}/workspaces` | `application/json+schema` | Embedded resource |
| Workspace | `niri://outputs/{name}/workspaces/{id}` | `application/json+schema` | Embedded resource |
| Windows (workspace-scoped) | `niri://outputs/{name}/workspaces/{id}/windows` | `application/json+schema` | Embedded resource |
| Window | `niri://outputs/{name}/workspaces/{id}/windows/{id}` | `application/json+schema` | Embedded resource |
| Windows (global) | `niri://windows` | `application/json+schema` | Embedded resource |
| Window (global) | `niri://windows/{id}` | `application/json+schema` | Embedded resource |
| Layers | `niri://layers` | `application/json+schema` | Embedded resource |
| Keyboard layouts | `niri://keyboard-layouts` | `application/json+schema` | Embedded resource |
| Overview state | `niri://overview-state` | `application/json+schema` | Embedded resource |

### Collection Resources

Collection resources (ending without an identifier) will return arrays:

```json
{
  "uri": "niri://outputs/DP-1/workspaces",
  "items": [
    "niri://outputs/DP-1/workspaces/1",
    "niri://outputs/DP-1/workspaces/2"
  ]
}
```

Or expanded view (via query parameter `?expand=true`):

```json
{
  "uri": "niri://outputs/DP-1/workspaces",
  "items": [
    {
      "uri": "niri://outputs/DP-1/workspaces/1",
      "data": { ...workspace data... }
    },
    {
      "uri": "niri://outputs/DP-1/workspaces/2",
      "data": { ...workspace data... }
    }
  ]
}
```

### Annotations

Resources will include annotations to guide client behavior:

```typescript
annotations: {
  audience: ["assistant"],      // Who should use this resource
  priority: 1.0,              // Importance (0.0-1.0)
  lastModified: "2025-01-11T17:00:00Z"  // For caching
}
```

### Query Parameters

Resources will support standard query parameters:

- `?expand=true` - Return full data instead of URIs for collections
- `?fields=id,name,output` - Select specific fields (uses existing filter utility)
- `?filter=output:DP-1` - Filter results (uses existing filter utility)

## Rationale

### Why Embedded Resources?

1. **Type safety** - Clients can validate structured data against schemas
2. **Better DX** - LLMs and IDEs can understand resource structure without parsing strings
3. **Efficiency** - Single round-trip for structured data vs text + parse
4. **MCP compliance** - Leverages MCP's designed resource capabilities

### Why Hierarchical URIs?

1. **Reflects domain model** - Output → Workspace → Window relationships are explicit
2. **Context-aware queries** - "All workspaces on DP-1" becomes `niri://outputs/DP-1/workspaces`
3. **Natural navigation** - Clients can navigate relationships by extending paths
4. **RESTful patterns** - Familiar to developers working with HTTP APIs
5. **Explicit scope** - Makes it clear which output/workspace a window belongs to

### Why `niri://` Scheme?

1. **Namespace isolation** - Prevents URI conflicts with file:// or http://
2. **Clear origin** - Immediately identifies niri-mcp as the source
3. **Custom semantics** - We can define resource-specific behavior (e.g., subscriptions)

### Why Annotations?

1. **Audience targeting** - Direct resources to users vs. assistants
2. **Priority hints** - Help clients optimize display order
3. **Cache control** - lastModified enables smart caching
4. **MCP standard** - Built-in MCP feature for resource metadata

### Backwards Compatibility

Existing tools will remain unchanged, providing a migration path:
- Phase 1: Add resources alongside tools (dual approach)
- Phase 2: Encourage resource usage via documentation
- Phase 3: Deprecate tools (if desired, or keep both)

## Consequences

### Positive

1. **Better MCP compliance** - Leverages full resource capabilities
2. **Improved discoverability** - `resources/list` reveals structure
3. **Type safety** - Schema-based validation possible
4. **Explicit relationships** - Hierarchy makes parent-child clear
5. **Flexible querying** - Expand, filter, field selection support
6. **Future-proof** - Ready for subscriptions and change notifications

### Negative

1. **Increased complexity** - More code to maintain (resource handlers, URI parsing)
2. **Larger bundle** - Additional handlers and utilities
3. **Learning curve** - New developers must understand resource model
4. **Dual maintenance** - Tools and resources both exist during transition

### Neutral

1. **Breaking changes** - None; tools remain functional
2. **Performance** - Minimal impact; resources use same underlying commands
3. **Dependencies** - No new dependencies required

## Implementation Plan

### Phase 1: Core Infrastructure

1. Create `tool/resource/` directory structure
2. Implement URI parser (`niri://outputs/DP-1/workspaces/1` → components)
3. Create resource registry mapping URIs to handlers
4. Add `resources/list` and `resources/read` handlers

### Phase 2: Collection Resources

1. Implement root collection resources (`outputs/`, `windows/`, `layers/`)
2. Support `?expand` query parameter
3. Add collection-level annotations

### Phase 3: Hierarchical Resources

1. Implement output-scoped workspaces (`outputs/{name}/workspaces/`)
2. Implement workspace-scoped windows (`outputs/{name}/workspaces/{id}/windows/`)
3. Add resource relationship navigation

### Phase 4: Filtering & Selection

1. Integrate existing `utils/filter.ts` with resource handlers
2. Support `?fields=` and `?filter=` query parameters
3. Add field schema to resource metadata

### Phase 5: Advanced Features

1. Add change notifications (if niri supports watching)
2. Implement resource subscriptions via `resources/subscribe`
3. Add cache control headers/annotations
4. Consider snapshot/history URIs (optional)

### File Structure

```
tool/
├── resource/
│   ├── index.ts              # Resource registry and list/read handlers
│   ├── uri-parser.ts         # Parse niri:// URIs into components
│   ├── collections/
│   │   ├── outputs.ts        # All outputs
│   │   ├── workspaces.ts     # All workspaces (or per-output)
│   │   ├── windows.ts        # All windows (or per-workspace)
│   │   ├── layers.ts
│   │   ├── keyboard-layouts.ts
│   │   └── overview-state.ts
│   ├── entities/
│   │   ├── output.ts         # Single output
│   │   ├── workspace.ts      # Single workspace
│   │   └── window.ts        # Single window
│   └── types.ts             # Resource-specific types (reuse msg types)
tool/msg/                     # Keep existing tools
```

### Resource Handler Interface

```typescript
interface ResourceHandler {
  uri: string;
  mimeType: string;
  annotations?: ResourceAnnotations;
  handle(params: {
    expand?: boolean;
    fields?: string[];
    filter?: Record<string, unknown>;
  }): Promise<EmbeddedResource>;
}
```

### Example Resource Handler

```typescript
export const outputWorkspacesResource: ResourceHandler = {
  uri: "niri://outputs/{name}/workspaces",
  mimeType: "application/json+schema",
  annotations: {
    audience: ["assistant"],
    priority: 0.9,
  },
  async handle({ expand, fields, filter }) {
    const outputName = this.uri.split('/')[2];
    const stdout = await x("niri", ["msg", "--json", "workspaces"]);
    const allWorkspaces = JSON.parse(stdout) as Workspace[];
    const outputWorkspaces = allWorkspaces.filter(ws => ws.output === outputName);
    
    if (expand) {
      return {
        uri: `niri://outputs/${outputName}/workspaces`,
        mimeType: this.mimeType,
        items: outputWorkspaces.map(ws => ({
          uri: `niri://outputs/${outputName}/workspaces/${ws.id}`,
          data: query([ws], { fields, filter }),
        })),
      };
    }
    
    return {
      uri: `niri://outputs/${outputName}/workspaces`,
      mimeType: this.mimeType,
      items: outputWorkspaces.map(ws => `niri://outputs/${outputName}/workspaces/${ws.id}`),
    };
  },
};
```

## Alternatives Considered

### Alternative 1: Flat URI Structure

**Proposal:** All resources at root level with query parameters
- `niri://workspaces?output=DP-1`
- `niri://windows?workspace_id=1`

**Rejected:** Doesn't reflect domain relationships; URI parsing more complex; less navigable

### Alternative 2: File URIs

**Proposal:** Use `file:///` scheme for outputs
- `file:///outputs/DP-1/workspaces.json`

**Rejected:** Misleading (not actual files); conflicts with real file resources; scheme semantics don't match

### Alternative 3: HTTP-like Paths

**Proposal:** Drop custom scheme, use relative URIs
- `outputs/DP-1/workspaces/1`

**Rejected:** Ambiguous origin; requires base URI; can't differentiate niri-mcp from other MCP servers

## References

- [MCP Resources Specification](https://modelcontextprotocol.io/docs/concepts/resources/)
- [MCP Tools Specification](https://modelcontextprotocol.io/docs/concepts/tools/)
- [RESTful API Design: Best Practices](https://restfulapi.net/)
- [Architectural Decision Records](https://adr.github.io/)
