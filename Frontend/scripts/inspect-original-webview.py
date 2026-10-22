#!/usr/bin/env python3
"""Read-only CDP diagnostics for the original Android WebView; no UI injection."""
from contextlib import closing
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import websocket

out = Path(sys.argv[1])
report = {"contexts": [], "console": [], "errors": []}
try:
    pid = subprocess.check_output(["adb", "shell", "pidof", "in.juspay.nammayatri.debug"], text=True).strip().split()[0]
    subprocess.run(["adb", "forward", "tcp:9222", f"localabstract:webview_devtools_remote_{pid}"], check=True, capture_output=True)
    with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=8) as response:
        targets = json.load(response)
    report["targets"] = [{"id": t.get("id"), "type": t.get("type"), "url": t.get("url")} for t in targets]
    for target in targets:
        if not target.get("webSocketDebuggerUrl"):
            continue
        contexts = []
        with closing(websocket.create_connection(target["webSocketDebuggerUrl"], timeout=5, suppress_origin=True)) as ws:
            counter = 0
            def call(method, params=None):
                global counter
                counter += 1
                request_id = counter
                ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    msg = json.loads(ws.recv())
                    if msg.get("method") == "Runtime.executionContextCreated":
                        contexts.append(msg["params"]["context"])
                    if msg.get("method") in ("Console.messageAdded", "Runtime.exceptionThrown") and len(report["console"]) < 250:
                        report["console"].append(msg)
                    if msg.get("id") == request_id:
                        return msg
                raise TimeoutError(method)
            call("Runtime.enable")
            call("Console.enable")
            for context in contexts:
                expression = """JSON.stringify({url:location.href,readyState:document.readyState,os:window.__OS,
                josType:typeof window.JOS,josSelf:window.JOS&&window.JOS.self,bridgeType:typeof window.JBridge,
                version:window.version||null,merchant:window.merchantID,
                scripts:Array.from(document.scripts).map(s=>({id:s.id,src:s.src,length:s.textContent.length})),
                bodyText:document.body?document.body.innerText.slice(0,1200):null,
                globals:['purescript','getTrackerModule','onEvent',"onEvent'",'merchantID'].map(k=>[k,typeof window[k]])})"""
                state = call("Runtime.evaluate", {"expression": expression, "contextId": context["id"], "returnByValue": True})
                report["contexts"].append({"target": target.get("id"), "context": context, "state": state})
except Exception as error:
    report["errors"].append(f"{type(error).__name__}: {error}")
text = json.dumps(report, ensure_ascii=False, indent=2)
text = re.sub(r"AIza[0-9A-Za-z_-]{20,}", "[REDACTED_GOOGLE_KEY]", text)
text = re.sub(r"(?i)(bearer\s+)[a-z0-9._~-]+", r"\1[REDACTED]", text)
(out / "webview-state.json").write_text(text)
print("CDP contexts:", len(report["contexts"]), "diagnostic errors:", len(report["errors"]))
