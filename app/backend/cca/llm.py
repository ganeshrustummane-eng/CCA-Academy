"""Provider-agnostic LLM layer.

Neutral message format (OpenAI-like):
  {"role": "user"|"system", "content": str}
  {"role": "assistant", "content": str, "tool_calls": [{"id", "name", "arguments": dict}]}
  {"role": "tool", "tool_call_id": str, "content": str}

Neutral tool: {"name", "description", "parameters": <JSON schema>}
tool_choice: None | "auto" | "any" | {"name": "<tool>"}

Every client returns LLMResponse with a normalised stop_reason:
  "tool_use" when the model wants tools run, "end_turn" when finished,
  "max_tokens" when truncated. This mirrors the signal the exam teaches (task 1.1).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable

DIAL_ENDPOINT = "https://ai-proxy.lab.epam.com"
DIAL_API_VERSION = "2025-04-01-preview"


class LLMError(Exception):
    """Raised for provider failures. Message never contains API keys."""


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class LLMResponse:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str = "end_turn"


class LLMClient:
    def chat(self, messages: list[dict], tools: list[dict] | None = None,
             tool_choice: Any = None, temperature: float | None = None,
             max_tokens: int = 2048) -> LLMResponse:  # pragma: no cover - interface
        raise NotImplementedError


# ---------------------------------------------------------------- OpenAI-compatible (DIAL, OpenAI)

def _to_openai_tools(tools):
    return [{"type": "function",
             "function": {"name": t["name"], "description": t.get("description", ""),
                          "parameters": t["parameters"]}} for t in tools]


def _to_openai_choice(choice):
    if choice is None or choice == "auto":
        return "auto"
    if choice == "any":
        return "required"
    if isinstance(choice, dict) and "name" in choice:
        return {"type": "function", "function": {"name": choice["name"]}}
    raise LLMError(f"Unsupported tool_choice: {choice!r}")


def _to_openai_messages(messages):
    out = []
    for m in messages:
        if m["role"] == "assistant" and m.get("tool_calls"):
            out.append({"role": "assistant", "content": m.get("content") or None,
                        "tool_calls": [{"id": c["id"], "type": "function",
                                        "function": {"name": c["name"],
                                                     "arguments": json.dumps(c["arguments"])}}
                                       for c in m["tool_calls"]]})
        else:
            out.append(dict(m))
    return out


class OpenAICompatClient(LLMClient):
    """Works for DIAL (AzureOpenAI-style proxy) and plain OpenAI-compatible endpoints."""

    def __init__(self, api_key: str, model: str, provider: str = "dial",
                 endpoint: str | None = None, api_version: str = DIAL_API_VERSION):
        if not api_key:
            raise LLMError("No API key provided. Add one in Settings or set LLM_API_KEY on the server.")
        self.model = model
        try:
            if provider == "dial":
                from openai import AzureOpenAI
                self._c = AzureOpenAI(api_key=api_key, api_version=api_version,
                                      azure_endpoint=endpoint or DIAL_ENDPOINT)
            else:
                from openai import OpenAI
                self._c = OpenAI(api_key=api_key, base_url=endpoint) if endpoint else OpenAI(api_key=api_key)
        except ImportError as e:  # pragma: no cover
            raise LLMError("The 'openai' package is not installed.") from e

    def chat(self, messages, tools=None, tool_choice=None, temperature=None, max_tokens=2048):
        kwargs: dict[str, Any] = {"model": self.model, "messages": _to_openai_messages(messages)}
        if temperature is not None:
            kwargs["temperature"] = temperature
        if tools:
            kwargs["tools"] = _to_openai_tools(tools)
            kwargs["tool_choice"] = _to_openai_choice(tool_choice)
        try:
            r = self._c.chat.completions.create(**kwargs)
        except Exception as e:  # keep provider errors readable, never echo credentials
            raise LLMError(_safe_err(e)) from None
        ch = r.choices[0]
        calls = []
        for tc in (ch.message.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {"_raw": tc.function.arguments}
            calls.append(ToolCall(tc.id, tc.function.name, args))
        reason = {"tool_calls": "tool_use", "stop": "end_turn", "length": "max_tokens"}.get(
            ch.finish_reason, "end_turn")
        if calls and reason == "end_turn":
            reason = "tool_use"
        return LLMResponse(ch.message.content or "", calls, reason)


# ---------------------------------------------------------------- Anthropic

class AnthropicClient(LLMClient):
    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise LLMError("No API key provided.")
        self.model = model
        try:
            import anthropic
            self._c = anthropic.Anthropic(api_key=api_key)
        except ImportError as e:  # pragma: no cover
            raise LLMError("The 'anthropic' package is not installed.") from e

    @staticmethod
    def _convert(messages):
        system, out = [], []
        for m in messages:
            if m["role"] == "system":
                system.append(m["content"])
            elif m["role"] == "user":
                out.append({"role": "user", "content": m["content"]})
            elif m["role"] == "assistant":
                blocks = []
                if m.get("content"):
                    blocks.append({"type": "text", "text": m["content"]})
                for c in m.get("tool_calls", []):
                    blocks.append({"type": "tool_use", "id": c["id"], "name": c["name"],
                                   "input": c["arguments"]})
                out.append({"role": "assistant", "content": blocks or m.get("content", "")})
            elif m["role"] == "tool":
                block = {"type": "tool_result", "tool_use_id": m["tool_call_id"], "content": m["content"]}
                if out and out[-1]["role"] == "user" and isinstance(out[-1]["content"], list) \
                        and out[-1]["content"] and out[-1]["content"][0].get("type") == "tool_result":
                    out[-1]["content"].append(block)
                else:
                    out.append({"role": "user", "content": [block]})
        return "\n\n".join(system), out

    def chat(self, messages, tools=None, tool_choice=None, temperature=None, max_tokens=2048):
        system, msgs = self._convert(messages)
        kwargs: dict[str, Any] = {"model": self.model, "messages": msgs, "max_tokens": max_tokens}
        if system:
            kwargs["system"] = system
        if temperature is not None:
            kwargs["temperature"] = temperature
        if tools:
            kwargs["tools"] = [{"name": t["name"], "description": t.get("description", ""),
                                "input_schema": t["parameters"]} for t in tools]
            if tool_choice == "any":
                kwargs["tool_choice"] = {"type": "any"}
            elif isinstance(tool_choice, dict):
                kwargs["tool_choice"] = {"type": "tool", "name": tool_choice["name"]}
            else:
                kwargs["tool_choice"] = {"type": "auto"}
        try:
            r = self._c.messages.create(**kwargs)
        except Exception as e:
            raise LLMError(_safe_err(e)) from None
        text, calls = "", []
        for b in r.content:
            if b.type == "text":
                text += b.text
            elif b.type == "tool_use":
                calls.append(ToolCall(b.id, b.name, dict(b.input)))
        reason = {"tool_use": "tool_use", "end_turn": "end_turn", "max_tokens": "max_tokens",
                  "stop_sequence": "end_turn"}.get(r.stop_reason, "end_turn")
        return LLMResponse(text, calls, reason)


# ---------------------------------------------------------------- Mock (tests, offline demo)

class MockClient(LLMClient):
    """Scripted client. `script` is a list of LLMResponse or callables(messages, tools, tool_choice)."""

    def __init__(self, script: list):
        self.script = list(script)
        self.calls: list[dict] = []

    def chat(self, messages, tools=None, tool_choice=None, temperature=None, max_tokens=2048):
        self.calls.append({"messages": [dict(m) for m in messages], "tools": tools,
                           "tool_choice": tool_choice})
        if not self.script:
            raise LLMError("MockClient script exhausted")
        nxt = self.script.pop(0)
        return nxt(messages, tools, tool_choice) if callable(nxt) else nxt


def _safe_err(e: Exception) -> str:
    msg = str(e)
    for marker in ("api-key", "Api-Key", "Authorization", "sk-"):
        if marker in msg:
            return f"{type(e).__name__}: request failed (details hidden to protect credentials)"
    return f"{type(e).__name__}: {msg[:300]}"


def make_client(provider: str, api_key: str, model: str, endpoint: str | None = None,
                api_version: str = DIAL_API_VERSION) -> LLMClient:
    provider = (provider or "dial").lower()
    if provider in ("dial", "openai"):
        return OpenAICompatClient(api_key, model, provider, endpoint, api_version)
    if provider == "anthropic":
        return AnthropicClient(api_key, model)
    raise LLMError(f"Unknown provider: {provider}")
