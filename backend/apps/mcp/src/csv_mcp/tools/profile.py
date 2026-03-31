from __future__ import annotations

from typing import Any

from csv_mcp.backend import BackendClient


def get_profile_tool(client: BackendClient, arguments: dict[str, Any]) -> dict[str, Any]:
    client.authenticate(email=str(arguments["email"]), password=str(arguments["password"]))
    return client.read_profile()
