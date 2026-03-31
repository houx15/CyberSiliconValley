from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Any, Callable

import httpx

from csv_mcp.backend import BackendApiError, BackendClient
from csv_mcp.tools import get_graph_tool, get_keyword_jobs_tool, get_profile_tool, list_inbox_tool, list_matches_tool


ToolHandler = Callable[[BackendClient, dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolHandler


def build_tool_registry() -> dict[str, ToolDefinition]:
    return {
        "get_profile": ToolDefinition(
            name="get_profile",
            description="Log in as a CSV user and read the current profile.",
            input_schema={
                "type": "object",
                "properties": {
                    "apiBaseUrl": {"type": "string"},
                    "email": {"type": "string"},
                    "password": {"type": "string"},
                },
                "required": ["email", "password"],
            },
            handler=get_profile_tool,
        ),
        "list_matches": ToolDefinition(
            name="list_matches",
            description="Log in as an enterprise user and list current match records.",
            input_schema={
                "type": "object",
                "properties": {
                    "apiBaseUrl": {"type": "string"},
                    "email": {"type": "string"},
                    "password": {"type": "string"},
                },
                "required": ["email", "password"],
            },
            handler=list_matches_tool,
        ),
        "list_inbox": ToolDefinition(
            name="list_inbox",
            description="Log in as a CSV user and list inbox items.",
            input_schema={
                "type": "object",
                "properties": {
                    "apiBaseUrl": {"type": "string"},
                    "email": {"type": "string"},
                    "password": {"type": "string"},
                    "filter": {"type": "string"},
                },
                "required": ["email", "password"],
            },
            handler=list_inbox_tool,
        ),
        "get_graph": ToolDefinition(
            name="get_graph",
            description="Read the opportunity graph data without authentication.",
            input_schema={
                "type": "object",
                "properties": {"apiBaseUrl": {"type": "string"}},
            },
            handler=get_graph_tool,
        ),
        "get_keyword_jobs": ToolDefinition(
            name="get_keyword_jobs",
            description="Read the jobs linked to a graph keyword and optional job detail.",
            input_schema={
                "type": "object",
                "properties": {
                    "apiBaseUrl": {"type": "string"},
                    "keyword": {"type": "string"},
                    "jobId": {"type": "string"},
                },
                "required": ["keyword"],
            },
            handler=get_keyword_jobs_tool,
        ),
    }


class CsvMcpServer:
    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport
        self._tools = build_tool_registry()

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": definition.name,
                "description": definition.description,
                "inputSchema": definition.input_schema,
            }
            for definition in self._tools.values()
        ]

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        definition = self._tools.get(name)
        if definition is None:
            return {"content": [{"type": "text", "text": f"Unknown tool: {name}"}], "structuredContent": {}, "isError": True}

        arguments = arguments or {}
        client = BackendClient(base_url=arguments.get("apiBaseUrl"), transport=self._transport)
        try:
            payload = definition.handler(client, arguments)
        except BackendApiError as exc:
            return {
                "content": [{"type": "text", "text": f"Backend error ({exc.status_code}): {exc}"}],
                "structuredContent": {},
                "isError": True,
            }
        finally:
            client.close()

        return {
            "content": [{"type": "text", "text": json.dumps(payload, sort_keys=True, default=str)}],
            "structuredContent": payload,
            "isError": False,
        }

    def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        method = request.get("method")
        request_id = request.get("id")

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "serverInfo": {"name": "csv-mcp", "version": "0.1.0"},
                    "capabilities": {"tools": {"listChanged": False}},
                },
            }

        if method == "tools/list":
            return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": self.list_tools()}}

        if method == "tools/call":
            params = request.get("params") or {}
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": self.call_tool(str(params.get("name", "")), params.get("arguments") or {}),
            }

        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }


def main() -> int:
    server = CsvMcpServer()
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        request = json.loads(line)
        response = server.handle_request(request)
        print(json.dumps(response, sort_keys=True), flush=True)
    return 0
