"""Agent playground: a simulated customer-support agent that makes exam concepts visible.

Toggles let the learner see what changes:
  loop_mode  "correct"    -> loop on stop_reason (tool_use / end_turn)
             "text_check" -> ANTI-PATTERN: stop as soon as the reply contains text
  gate       block process_refund until verify_customer succeeded (programmatic prerequisite gate)
  hook       block refunds above REFUND_LIMIT and return an escalation handoff (pre-call hook)
  normalise  PostToolUse-style hook: convert unix timestamps to ISO 8601 before the model sees them
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from .llm import LLMClient

REFUND_LIMIT = 500
SAFETY_CAP = 10  # safety net only, never the primary stop condition

CUSTOMERS = {"C100": {"name": "Jane Doe", "email": "jane@example.com"}}
ORDERS = {
    "O1": {"customer": "C100", "total": 120, "status": 3, "placed": 1767225600},
    "O2": {"customer": "C100", "total": 750, "status": 3, "placed": 1768435200},
}

TOOLS = [
    {"name": "verify_customer",
     "description": "Verify account ownership. Input: customer_id (e.g. C100) and the email on file. "
                    "Must succeed before any refund. Does not return order data; use lookup_order for orders.",
     "parameters": {"type": "object", "properties": {"customer_id": {"type": "string"}, "email": {"type": "string"}},
                    "required": ["customer_id", "email"]}},
    {"name": "lookup_order",
     "description": "Look up one order by order_id (e.g. O1): total, status, placed date. "
                    "Use for order questions; use verify_customer for identity checks.",
     "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}},
    {"name": "process_refund",
     "description": "Refund an order. Inputs: order_id and amount in USD. Irreversible. "
                    "Only call after the customer is verified.",
     "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}, "amount": {"type": "number"}},
                    "required": ["order_id", "amount"]}},
]

SYSTEM = ("You are a customer support agent. Help the customer using the tools. "
          "Verify the customer before refunding. Be brief.")

STATUS_NAMES = {1: "pending", 2: "shipped", 3: "delivered"}


class Session:
    def __init__(self):
        self.verified: set[str] = set()
        self.refunds: list[dict] = []


def _err(category: str, retryable: bool, message: str) -> dict:
    return {"isError": True, "errorCategory": category, "isRetryable": retryable, "message": message}


def _run_tool(name: str, args: dict, sess: Session, opts: dict, trace: list) -> dict:
    # --- gate: programmatic prerequisite enforcement
    if name == "process_refund":
        order = ORDERS.get(args.get("order_id", ""))
        if opts["gate"] and (not order or order["customer"] not in sess.verified):
            trace.append({"type": "gate", "text": "BLOCKED process_refund: customer not verified yet."})
            return _err("business", False, "Customer must be verified before a refund. Call verify_customer first.")
        # --- hook: policy interception before execution
        try:
            amount = float(args.get("amount"))
        except (TypeError, ValueError):
            return _err("validation", False, "amount must be a number")
        if opts["hook"] and amount > REFUND_LIMIT:
            trace.append({"type": "hook", "text": f"BLOCKED refund ${amount:.0f} > ${REFUND_LIMIT}: escalating to human."})
            return {"isError": True, "errorCategory": "business", "isRetryable": False,
                    "message": f"Refunds above ${REFUND_LIMIT} need human approval. Escalating.",
                    "handoff": {"customer_id": order["customer"] if order else None, "order_id": args.get("order_id"),
                                "amount": amount, "root_cause": "Refund exceeds automatic limit",
                                "recommended_action": "Human review and approve or deny"}}
        if not order:
            return _err("validation", False, "Unknown order_id")
        sess.refunds.append({"order_id": args["order_id"], "amount": amount})
        return {"ok": True, "refunded": amount, "order_id": args["order_id"]}
    if name == "verify_customer":
        c = CUSTOMERS.get(args.get("customer_id", ""))
        if c and c["email"].lower() == str(args.get("email", "")).lower():
            sess.verified.add(args["customer_id"])
            return {"verified": True, "customer_id": args["customer_id"]}
        return {"verified": False}  # valid answer, not an access failure
    if name == "lookup_order":
        o = ORDERS.get(args.get("order_id", ""))
        if not o:
            return {"found": False, "orders": []}  # valid empty result: do not retry
        out = {"found": True, "order_id": args["order_id"], "customer_id": o["customer"], "total": o["total"],
               "status": o["status"], "placed": o["placed"]}
        if opts["normalise"]:
            out["placed"] = datetime.fromtimestamp(o["placed"], tz=timezone.utc).isoformat()
            out["status"] = STATUS_NAMES.get(o["status"], "unknown")
            trace.append({"type": "normalise", "text": "PostToolUse hook: timestamp -> ISO 8601, status code -> name."})
        return out
    return _err("validation", False, f"Unknown tool {name}")


def demo_client():
    """Offline scripted 'model' so learners can see the mechanics without any API key."""
    from .llm import LLMResponse, MockClient, ToolCall
    return MockClient([
        LLMResponse("I'll process that refund right away.",
                    [ToolCall("t1", "process_refund", {"order_id": "O2", "amount": 750})], "tool_use"),
        LLMResponse("", [ToolCall("t2", "verify_customer",
                                  {"customer_id": "C100", "email": "jane@example.com"})], "tool_use"),
        LLMResponse("", [ToolCall("t3", "process_refund", {"order_id": "O2", "amount": 750})], "tool_use"),
        LLMResponse("This refund is above our automatic limit, so I've escalated it to a human agent "
                    "with the full details. They will follow up.", [], "end_turn"),
    ])


def run_agent(client: LLMClient, user_message: str, opts: dict | None = None) -> dict:
    opts = {"loop_mode": "correct", "gate": True, "hook": True, "normalise": True, **(opts or {})}
    sess, trace = Session(), []
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_message[:2000]}]
    final, stopped_by = "", "safety_cap"
    for turn in range(1, SAFETY_CAP + 1):
        resp = client.chat(messages, tools=TOOLS, tool_choice="auto", max_tokens=700)
        trace.append({"type": "model", "turn": turn, "stop_reason": resp.stop_reason,
                      "text": resp.text, "tool_calls": [{"name": c.name, "arguments": c.arguments} for c in resp.tool_calls]})
        messages.append({"role": "assistant", "content": resp.text,
                         "tool_calls": [{"id": c.id, "name": c.name, "arguments": c.arguments} for c in resp.tool_calls]})
        if opts["loop_mode"] == "text_check" and resp.text.strip():
            # ANTI-PATTERN: treating "has text" as completion; tool calls beside the text are dropped
            final, stopped_by = resp.text, "text_present (anti-pattern)"
            if resp.tool_calls:
                trace.append({"type": "bug", "text": f"Loop ended early: {len(resp.tool_calls)} requested tool call(s) were never run."})
            break
        if resp.stop_reason != "tool_use":
            final, stopped_by = resp.text, resp.stop_reason
            break
        for c in resp.tool_calls:
            result = _run_tool(c.name, c.arguments, sess, opts, trace)
            trace.append({"type": "tool", "name": c.name, "arguments": c.arguments, "result": result})
            messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(result)})
    return {"final": final, "stopped_by": stopped_by, "trace": trace, "refunds": sess.refunds, "options": opts}
