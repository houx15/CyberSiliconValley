from __future__ import annotations

import httpx

from csv_mcp.main import CsvMcpServer


def _build_transport(calls: list[tuple[str, str]]):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.url.path == "/api/v1/auth/login":
            return httpx.Response(200, json={"user": {"id": "e-1", "email": "enterprise1@csv.dev", "role": "enterprise"}})
        if request.url.path == "/api/v1/matches":
            return httpx.Response(200, json={"matches": [{"matchId": "m-1", "jobId": "j-1", "talentId": "t-1", "score": 91.0, "breakdown": {}, "status": "new", "createdAt": "2026-03-31T00:00:00Z"}]})
        if request.url.path == "/api/v1/graph":
            return httpx.Response(200, json={"nodes": [{"id": "k-1", "keyword": "agents", "jobCount": 3, "trending": True}], "edges": []})
        raise AssertionError(f"Unexpected request: {request.method} {request.url.path}")

    return httpx.MockTransport(handler)


def test_mcp_server_lists_registered_tools() -> None:
    server = CsvMcpServer()

    tools = server.list_tools()
    tool_names = {tool["name"] for tool in tools}

    assert {"get_profile", "list_matches", "list_inbox", "get_graph", "get_keyword_jobs"} <= tool_names


def test_mcp_call_tool_logs_in_and_reads_matches() -> None:
    calls: list[tuple[str, str]] = []

    server = CsvMcpServer(transport=_build_transport(calls))

    response = server.call_tool(
        "list_matches",
        {
            "apiBaseUrl": "http://api.test",
            "email": "enterprise1@csv.dev",
            "password": "csv2026",
        },
    )

    assert response["isError"] is False
    assert response["structuredContent"]["matches"][0]["matchId"] == "m-1"
    assert calls == [
        ("POST", "/api/v1/auth/login"),
        ("GET", "/api/v1/matches"),
    ]


def test_mcp_handle_request_supports_tools_list_and_tools_call() -> None:
    calls: list[tuple[str, str]] = []
    server = CsvMcpServer(transport=_build_transport(calls))

    tools_response = server.handle_request({"jsonrpc": "2.0", "id": "1", "method": "tools/list"})
    call_response = server.handle_request(
        {
            "jsonrpc": "2.0",
            "id": "2",
            "method": "tools/call",
            "params": {
                "name": "get_graph",
                "arguments": {"apiBaseUrl": "http://api.test"},
            },
        }
    )

    assert tools_response["result"]["tools"]
    assert call_response["result"]["structuredContent"]["nodes"][0]["keyword"] == "agents"
    assert calls == [("GET", "/api/v1/graph")]
