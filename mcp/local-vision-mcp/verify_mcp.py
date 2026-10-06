"""Exercise a full stdio MCP round trip through local Qwen3-VL."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

PROJECT_ROOT = Path(__file__).resolve().parent


async def verify(image_path: str) -> dict[str, object]:
    """List the MCP tool then make one bounded real visual request."""
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
        if "analyze_image" not in tool_names:
            raise RuntimeError("MCP server did not expose analyze_image")

        result = await session.call_tool(
            "analyze_image",
            {
                "image_path": image_path,
                "question": "请只回答：图中是否有可见文字？",
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
    parser = argparse.ArgumentParser(description="Verify the local vision MCP")
    parser.add_argument("image_path", help="Absolute or project-relative image path")
    arguments = parser.parse_args()
    result = asyncio.run(verify(arguments.image_path))
    print(json.dumps(result, ensure_ascii=False, indent=2))
