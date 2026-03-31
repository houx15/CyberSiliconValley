from __future__ import annotations

from typing import Any

from csv_mcp.backend import BackendClient


def get_graph_tool(client: BackendClient, arguments: dict[str, Any]) -> dict[str, Any]:
    return client.read_graph()


def get_keyword_jobs_tool(client: BackendClient, arguments: dict[str, Any]) -> dict[str, Any]:
    return client.read_keyword_jobs(
        keyword=str(arguments["keyword"]),
        job_id=str(arguments["jobId"]) if arguments.get("jobId") else None,
    )
