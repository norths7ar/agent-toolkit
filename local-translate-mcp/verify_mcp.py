"""Exercise a real stdio MCP round trip against the local Ollama model."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

PROJECT_ROOT = Path(__file__).resolve().parent


async def verify() -> dict[str, object]:
    """List the tool then translate one short, deterministic sentence."""
    server_parameters = StdioServerParameters(
        command=sys.executable,
        args=[str(PROJECT_ROOT / "server.py")],
        cwd=PROJECT_ROOT,
    )
    async with (
        stdio_client(server_parameters) as (read_stream, write_stream),
        ClientSession(read_stream, write_stream) as session,
    ):
        await session.initialize()
        tools = await session.list_tools()
        tool_names = [tool.name for tool in tools.tools]
        if "translate_text" not in tool_names:
            raise RuntimeError("MCP server did not expose translate_text")

        result = await session.call_tool(
            "translate_text",
            {
                "text": "本地模型已经可以工作了。",
                "source_language": "Chinese",
                "target_language": "English",
            },
        )
        if result.is_error:
            raise RuntimeError(f"MCP tool returned an error: {result.content}")

        return {
            "tools": tool_names,
            "result": result.structured_content
            or [item.model_dump() for item in result.content],
        }


if __name__ == "__main__":
    print(json.dumps(asyncio.run(verify()), ensure_ascii=False, indent=2))
