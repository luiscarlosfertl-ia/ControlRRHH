"""Export only the active HR FaceVision implementation; do not import app.py.

Importing the monolith would start unrelated Mongo/session/OCR integrations.
Functions are copied verbatim via AST, with explicit runtime globals. Source drift
must pass the profile smoke test before publishing a new image.
"""
import ast
import hashlib
import json
from pathlib import Path
import sys

FUNCTIONS = (
    "get_face_cascade", "_detect_faces_bgr", "_ctx_id", "_fa_key",
    "_reset_face_app", "_get_face_app", "_faces_for", "_get_embedding",
    "_largest_face_embedding", "_read_bgr_from_base64", "_embedding_to_json",
    "_face_embedding_engine_status", "_json_safe", "_quality_from_faces",
    "face_auth_enroll",
)
HEADER = '''# Generated from sdk-faceVision. Do not edit: regenerate the release context.
import base64
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Dict, Tuple, Optional, List
from pathlib import Path
import cv2
import numpy as np
import insightface
from flask import Flask, request, jsonify
from hr_fast_face import register_hr_fast_routes

logger = logging.getLogger("facevision.rrhh")
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024
APP_ROOT = str(Path(__file__).parent)
MODELS_DIR = str(Path.home() / ".insightface/models/buffalo_l")
for name in ("det_10g.onnx", "w600k_r50.onnx", "1k3d68.onnx", "2d106det.onnx", "genderage.onnx"):
    if not (Path(MODELS_DIR) / name).is_file():
        raise RuntimeError("Missing authorized buffalo_l model files. Mount models before starting.")
_FACE_CASCADE = None
_ARC_PROVIDERS = ["CPUExecutionProvider"]
_FA_APPS = {}
_FA_INIT_LOCK = threading.Lock()
_FA_LOCK = threading.Lock()
'''
FOOTER = '''
register_hr_fast_routes(app, _read_bgr_from_base64, _detect_faces_bgr, _faces_for)
# Warm the real model before serving health; never auto-download model weights.
_engine = _get_face_app((640, 640))
if "recognition" not in _engine.models or get_face_cascade().empty():
    raise RuntimeError("FaceVision detection/recognition model unavailable")
@app.get("/health")
def health():
    return jsonify(status="ok", profile="rrhh", engine="buffalo_l", provider="CPUExecutionProvider")
'''

def export(sdk, destination):
    source = (sdk / "app.py").read_text(encoding="utf-8-sig")
    tree = ast.parse(source)
    lines = source.splitlines(keepends=True)
    functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
    pieces = [HEADER]
    manifest = {}
    for name in FUNCTIONS:
        if name not in functions:
            raise ValueError(f"Active FaceVision function not found: {name}")
        node = functions[name]
        first = min([node.lineno] + [d.lineno for d in node.decorator_list])
        part = "".join(lines[first - 1:node.end_lineno])
        pieces.append(part)
        manifest[name] = hashlib.sha256(part.encode()).hexdigest()
    profile = "\n\n".join(pieces) + FOOTER
    compile(profile, "hr_runtime.py", "exec")
    fast = (sdk / "hr_fast_face.py").read_bytes()
    compile(fast, "hr_fast_face.py", "exec")
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "hr_runtime.py").write_text(profile, encoding="utf-8")
    (destination / "hr_fast_face.py").write_bytes(fast)
    (destination / "source-manifest.json").write_text(json.dumps({
        "profile": "rrhh-cpu", "functionsSha256": manifest,
        "fastRoutesSha256": hashlib.sha256(fast).hexdigest(),
    }, indent=2), encoding="utf-8")
    print("Exported FaceVision HR profile: detect, enroll, search (no session data).")

if __name__ == "__main__":
    export(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
