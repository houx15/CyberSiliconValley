from __future__ import annotations

from typing import Any

from csv_mcp.backend import BackendClient


def list_inbox_tool(client: BackendClient, arguments: dict[str, Any]) -> dict[str, Any]:
    client.authenticate(email=str(arguments["email"]), password=str(arguments["password"]))
    filter_value = str(arguments.get("filter", "all"))
    return client.list_inbox(filter_value=filter_value)
