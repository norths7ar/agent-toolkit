"""Exercise stdio MCP against server.py without registering it in Codex."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

PROJECT_ROOT = Path(__file__).resolve().parent


async def verify(image_path: str, question: str) -> dict[str, object]:
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
            {"image_path": image_path, "question": question},
        )
        if result.is_error:
            raise RuntimeError(f"MCP tool returned an error: {result.content}")

        return {
            "tools": tool_names,
            "result": result.structured_content
            or [item.model_dump() for item in result.content],
        }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify the MiMo Vision MCP stdio round trip"
    )
    parser.add_argument("image_path", help="Project-relative test-image path")
    parser.add_argument("--question", default="Describe this image in detail.")
    args = parser.parse_args()

    print(
        json.dumps(
            asyncio.run(verify(args.image_path, args.question)),
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
