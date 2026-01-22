# Design MCP Server

A Model Context Protocol (MCP) server for visual design tools - mindmaps, research workflows, and freeform canvases. Deployable to Cloudflare Workers.

## Features

- **Mindmap Creation**: Create visual mindmaps with central topics and branches
- **Research Workflows**: Pre-built templates for literature review, competitive analysis, user research
- **Canvas Operations**: Add/remove nodes, create connections, auto-layout
- **Export Options**: SVG vector graphics and JSON data
- **MCP Protocol**: Full MCP compatibility for AI assistant integration

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-servers/design-mcp
npm install
```

### 2. Create KV Namespace (Cloudflare)

```bash
# Login to Cloudflare
npx wrangler login

# Create KV namespace for production
npx wrangler kv:namespace create CANVAS_KV
# Copy the ID and update wrangler.toml

# Create KV namespace for preview/dev
npx wrangler kv:namespace create CANVAS_KV --preview
# Copy the preview_id and update wrangler.toml
```

### 3. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CANVAS_KV"
id = "YOUR_PRODUCTION_KV_ID"
preview_id = "YOUR_PREVIEW_KV_ID"
```

### 4. Local Development

```bash
npm run dev
# Server runs at http://localhost:8787
```

### 5. Deploy to Cloudflare

```bash
npm run deploy
# Deploys to https://design-mcp.YOUR_SUBDOMAIN.workers.dev
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `canvas_create` | Create a new canvas (mindmap/workflow/freeform) |
| `canvas_delete` | Delete a canvas |
| `canvas_add_node` | Add a node to a canvas |
| `canvas_update_node` | Update node properties |
| `canvas_delete_node` | Remove a node and its connections |
| `canvas_add_connection` | Connect two nodes |
| `canvas_delete_connection` | Remove a connection |
| `canvas_export_svg` | Export canvas as SVG |
| `canvas_export_json` | Export canvas as JSON |
| `canvas_import_json` | Import canvas from JSON |
| `canvas_layout_auto` | Auto-arrange nodes |
| `mindmap_create` | Quick-create a mindmap from topics |
| `mindmap_add_branch` | Add branches to existing mindmap |
| `workflow_create` | Create workflow from template |
| `canvas_list` | List all canvases |
| `canvas_get` | Get canvas details |

## API Endpoints

### MCP Protocol

- `GET /mcp/tools` - List available tools
- `POST /mcp/tools/call` - Execute a tool
- `GET /mcp/resources` - List resources
- `GET /mcp/resources/read?uri=...` - Read a resource

### REST API

- `GET /api/canvases` - List all canvases
- `GET /api/canvases/:id` - Get canvas by ID
- `POST /api/canvases` - Create canvas
- `DELETE /api/canvases/:id` - Delete canvas

## Usage Examples

### Create a Mindmap (via MCP)

```json
POST /mcp/tools/call
{
  "name": "mindmap_create",
  "arguments": {
    "name": "Product Roadmap",
    "centralTopic": "Q1 Goals",
    "branches": ["Feature A", "Feature B", "Bug Fixes", "Documentation"]
  }
}
```

### Create a Research Workflow

```json
POST /mcp/tools/call
{
  "name": "workflow_create",
  "arguments": {
    "name": "Market Research",
    "template": "competitive-analysis"
  }
}
```

### Add Node to Canvas

```json
POST /mcp/tools/call
{
  "name": "canvas_add_node",
  "arguments": {
    "canvasId": "uuid-here",
    "nodeType": "idea",
    "label": "New Feature Idea"
  }
}
```

## Integration with Claude/Cursor

Add to your MCP config:

```json
{
  "mcpServers": {
    "design-mcp": {
      "url": "https://design-mcp.YOUR_SUBDOMAIN.workers.dev"
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "design-mcp": {
      "url": "http://localhost:8787"
    }
  }
}
```

## Node Types

| Type | Icon | Use Case |
|------|------|----------|
| `idea` | 💡 | Brainstorming, concepts |
| `task` | ✓ | Action items, todos |
| `research` | 🔬 | Research items, investigations |
| `note` | 📝 | General notes, comments |
| `decision` | ⚖️ | Decision points, choices |
| `source` | 📥 | Data sources, inputs |
| `process` | ⚙️ | Processing steps |
| `analyze` | 📊 | Analysis steps |
| `output` | 📤 | Deliverables, outputs |

## Workflow Templates

- **Literature Review**: Source → Filter → Extract → Synthesize → Report
- **Competitive Analysis**: Identify → Collect → Gap Analysis → SWOT → Strategy
- **User Research**: Define → Collect → Code → Personas → Insights
- **Data Analysis**: Collection → Clean → Exploratory → Deep Analysis → Report

## License

MIT
