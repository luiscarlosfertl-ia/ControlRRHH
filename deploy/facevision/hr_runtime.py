# Generated from sdk-faceVision. Do not edit: regenerate the release context.
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


def get_face_cascade() -> cv2.CascadeClassifier:
    global _FACE_CASCADE
    if _FACE_CASCADE is not None:
        return _FACE_CASCADE
    candidates = []
    try:
        candidates.append(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    except Exception:
        pass
    candidates += [
        os.path.join(APP_ROOT, "haarcascade_frontalface_default.xml"),
        os.path.join(MODELS_DIR, "haarcascade_frontalface_default.xml"),
    ]
    for p in candidates:
        if p and os.path.exists(p):
            clf = cv2.CascadeClassifier(p)
            if not clf.empty():
                _FACE_CASCADE = clf
                break
    if _FACE_CASCADE is None:
        _FACE_CASCADE = cv2.CascadeClassifier()
    return _FACE_CASCADE


def _detect_faces_bgr(img_bgr: np.ndarray) -> List[tuple]:
    if img_bgr is None or not isinstance(img_bgr, np.ndarray) or img_bgr.size == 0:
        return []
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    clf = get_face_cascade()
    if clf.empty(): return []
    faces = clf.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    return faces if isinstance(faces, np.ndarray) else []


def _ctx_id() -> int:
    """ctx_id para InsightFace: 0 si CUDA, -1 si CPU."""
    return 0 if 'CUDAExecutionProvider' in _ARC_PROVIDERS else -1


def _fa_key(det_size: Tuple[int, int]) -> Tuple[int, Tuple[int, int]]:
    return (_ctx_id(), det_size)


def _reset_face_app(reason: str = ""):
    """
    Resetea TODO el cache (todas las instancias).
    Útil si ORT queda en estado inválido.
    """
    global _FA_APPS
    with _FA_INIT_LOCK:
        _FA_APPS.clear()
    if reason:
        logger.warning(f"[InsightFace] reset cache: {reason}")


def _get_face_app(det_size: Tuple[int, int]):
    """
    Retorna una instancia preparada específicamente para det_size.
    Importante: NO se reutiliza la misma instancia para distintos det_size.
    """
    if insightface is None:
        raise RuntimeError("InsightFace no instalado. Setea DISABLE_ARCFACE=1 para desactivar.")

    key = _fa_key(det_size)
    fa = _FA_APPS.get(key)
    if fa is not None:
        return fa

    with _FA_INIT_LOCK:
        fa = _FA_APPS.get(key)
        if fa is None:
            fa = insightface.app.FaceAnalysis(name="buffalo_l", providers=_ARC_PROVIDERS)
            fa.prepare(ctx_id=_ctx_id(), det_size=det_size)
            _FA_APPS[key] = fa
            logger.info(f"[InsightFace] init FaceAnalysis ctx_id={_ctx_id()} det_size={det_size}")
    return fa


def _faces_for(det_size: Tuple[int, int], img_bgr) -> list:
    """
    Detecta caras con det_size fijo (sin re-prepare).
    Reintenta 1 vez si ocurre el error típico de ORT.
    """
    if insightface is None or img_bgr is None:
        return []

    for attempt in range(2):
        try:
            with _FA_LOCK:
                fa = _get_face_app(det_size)
                return fa.get(img_bgr) or []
        except TypeError as e:
            _reset_face_app(str(e))
            if attempt == 1:
                logger.warning(f"[InsightFace] ORT TypeError persistente (det_size={det_size}): {e}")
                return []
        except Exception as e:
            logger.exception(f"[InsightFace] error en detección (det_size={det_size}): {e}")
            return []
    return []


def _get_embedding(img_bgr, det_size: Tuple[int, int]) -> Optional[np.ndarray]:
    faces = _faces_for(det_size, img_bgr)
    if not faces:
        return None
    f = max(
        faces,
        key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1])
    )
    e = getattr(f, "embedding", None)
    if e is None:
        return None
    e = e.astype(np.float32)
    return e / (np.linalg.norm(e) + 1e-12)


def _largest_face_embedding(img_bgr):
    if insightface is None or img_bgr is None:
        return None
    return _get_embedding(img_bgr, (640, 640))


def _read_bgr_from_base64(value: str):
    if not value:
        return None
    try:
        raw = str(value)
        if "," in raw and raw.lower().startswith("data:"):
            raw = raw.split(",", 1)[1]
        img_bytes = base64.b64decode(raw)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _embedding_to_json(embedding) -> list:
    if embedding is None:
        return []
    return np.asarray(embedding, dtype=np.float32).reshape(-1).tolist()


def _face_embedding_engine_status() -> tuple[bool, str]:
    if insightface is None:
        return False, "InsightFace no esta disponible en FaceVision. Revise dependencias del entorno Python."
    return True, ""


def _json_safe(value):
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


def _quality_from_faces(img_bgr, embedding) -> dict:
    faces = _detect_faces_bgr(img_bgr) if img_bgr is not None else []
    return {
        "facesDetected": int(len(faces) if faces is not None else 0),
        "hasEmbedding": bool(embedding is not None),
        "imageShape": list(getattr(img_bgr, "shape", []) or [])
    }


def _cos(a, b) -> float:
    """Coseno normalizado en [0..1]."""
    if a is None or b is None:
        return 0.0
    a = np.asarray(a, dtype=np.float32).reshape(-1)
    b = np.asarray(b, dtype=np.float32).reshape(-1)
    m = min(a.size, b.size)
    if m == 0:
        return 0.0
    a = a[:m]
    b = b[:m]
    a /= (np.linalg.norm(a) + 1e-12)
    b /= (np.linalg.norm(b) + 1e-12)
    return float(np.clip(np.dot(a, b), 0.0, 1.0))


def _template_embedding_items(template: dict) -> list[tuple[str, np.ndarray]]:
    emb = template.get("embeddings") or {}
    items = []
    for key, value in emb.items():
        parsed = _embedding_from_json(value)
        if parsed is not None:
            items.append((str(key), parsed))
    return items


@app.route("/face-auth/enroll", methods=["POST"])
def face_auth_enroll():
    try:
        body = request.get_json(silent=True) or {}
        captures = body.get("captures") or {}
        required = ("near",)
        images = {key: _read_bgr_from_base64(captures.get(key)) for key in required}
        if any(images[key] is None for key in required):
            return jsonify({"status": "nok", "message": "Se requiere captura de rostro."}), 400

        engine_ok, engine_message = _face_embedding_engine_status()
        if not engine_ok:
            return jsonify({"status": "nok", "message": engine_message}), 503

        embeddings = {"near": _largest_face_embedding(images["near"])}
        if any(embeddings[key] is None for key in required):
            return jsonify({
                "status": "nok",
                "message": "No se pudo detectar un rostro valido en la captura.",
                "quality": {key: _quality_from_faces(images[key], embeddings[key]) for key in required}
            }), 422

        return jsonify({
            "status": "ok",
            "template": {
                "version": "facevision-insightface-single-v1",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "embeddings": {key: _embedding_to_json(embeddings[key]) for key in required},
                "quality": {
                    "captureMode": "single",
                    "face": _quality_from_faces(images["near"], embeddings["near"])
                }
            }
        })
    except Exception as e:
        logger.exception("/face-auth/enroll error")
        return jsonify({"status": "nok", "message": str(e)}), 500


@app.route("/face-auth/verify", methods=["POST"])
def face_auth_verify():
    try:
        body = request.get_json(silent=True) or {}
        templates = body.get("templates") or []
        captures = body.get("captures") or {}
        required = ("near",)
        images = {key: _read_bgr_from_base64(captures.get(key)) for key in required}
        if not templates:
            return jsonify({"status": "nok", "message": "El usuario no tiene rostro enrolado."}), 400
        if any(images[key] is None for key in required):
            return jsonify({"status": "nok", "message": "Se requiere captura de rostro."}), 400

        engine_ok, engine_message = _face_embedding_engine_status()
        if not engine_ok:
            return jsonify({"status": "nok", "message": engine_message}), 503

        probe = {key: _largest_face_embedding(images[key]) for key in required}
        if any(probe[key] is None for key in required):
            return jsonify({"status": "nok", "message": "No se pudo detectar un rostro valido en la captura."}), 422

        best = {"similarity": 0.0, "templateIndex": -1, "detail": {}}
        for index, template in enumerate(templates):
            sims = []
            detail = {}
            for tpl_key, tpl_embedding in _template_embedding_items(template):
                sim = _cos(probe["near"], tpl_embedding)
                sims.append(sim)
                detail[f"near_vs_{tpl_key}"] = sim
            similarity = float(max(sims or [0.0]))
            if similarity > best["similarity"]:
                best = {"similarity": similarity, "templateIndex": index, "detail": detail}

        threshold = float(body.get("threshold") or 0.72)
        verified = bool(best["similarity"] >= threshold)
        return jsonify({
            "status": "ok",
            "verified": verified,
            "similarity": best["similarity"],
            "threshold": threshold,
            "templateIndex": best["templateIndex"],
            "quality": {
                "captureMode": "single",
                "face": _quality_from_faces(images["near"], probe["near"])
            },
            "comparisons": best["detail"],
            "liveness_single": None
        })
    except Exception as e:
        logger.exception("/face-auth/verify error")
        return jsonify({"status": "nok", "message": str(e)}), 500

register_hr_fast_routes(app, _read_bgr_from_base64, _detect_faces_bgr, _faces_for)
# Warm the real model before serving health; never auto-download model weights.
_engine = _get_face_app((640, 640))
if "recognition" not in _engine.models or get_face_cascade().empty():
    raise RuntimeError("FaceVision detection/recognition model unavailable")
@app.get("/health")
def health():
    return jsonify(status="ok", profile="rrhh", engine="buffalo_l", provider="CPUExecutionProvider")
