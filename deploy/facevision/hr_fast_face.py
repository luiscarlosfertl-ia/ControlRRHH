"""Stateless HR endpoints: cheap presence checks, one embedding per identification.

No frame, embedding or gallery is persisted or returned in these responses.
The original enrol/verify endpoints and their callers remain unchanged.
"""
import time
import cv2
import numpy as np
from flask import request, jsonify


def register_hr_fast_routes(app, read_image, detect_faces, faces_for):
    def image_from(body):
        raw = (body.get("captures") or {}).get("near")
        if not isinstance(raw, str) or len(raw) > 900000:
            raise ValueError("Se requiere una captura facial liviana.")
        image = read_image(raw)
        if image is None or image.size == 0 or image.shape[0] * image.shape[1] > 4000000:
            raise ValueError("Imagen de cámara inválida.")
        return image

    @app.post("/face-auth/detect")
    def hr_fast_detect():
        started = time.perf_counter()
        try:
            image = image_from(request.get_json(silent=True) or {})
            height, width = image.shape[:2]
            scale = min(1.0, 512 / max(height, width))
            if scale < 1:
                image = cv2.resize(image, (round(width * scale), round(height * scale)))
            height, width = image.shape[:2]
            faces = detect_faces(image)
            boxes = [dict(x=float(x / width), y=float(y / height), width=float(w / width), height=float(h / height)) for x, y, w, h in faces]
            return jsonify(status="ok", faces=boxes, facesDetected=len(boxes), elapsedMs=round((time.perf_counter() - started) * 1000, 1))
        except (ValueError, TypeError, AttributeError):
            return jsonify(status="nok", message="Captura inválida."), 400
        except Exception:
            return jsonify(status="nok", message="No se pudo detectar el rostro."), 503

    @app.post("/face-auth/search")
    def hr_batch_search():
        started = time.perf_counter()
        try:
            body = request.get_json(silent=True) or {}
            threshold = float(body.get("threshold", 0.72))
            if not np.isfinite(threshold) or not 0.72 <= threshold <= 1:
                raise ValueError("Umbral inválido.")
            candidates = body.get("candidates")
            if not isinstance(candidates, list) or len(candidates) > 2000:
                raise ValueError("Catálogo inválido.")
            ids = [c.get("id") for c in candidates if isinstance(c, dict)]
            if len(ids) != len(candidates) or any(not isinstance(i, str) or not i or len(i) > 100 for i in ids) or len(set(ids)) != len(ids):
                raise ValueError("Identificadores inválidos.")
            image = image_from(body)
            # InsightFace runs once for the entire gallery and also counts faces.
            faces = faces_for((640, 640), image)
            if len(faces) != 1:
                return jsonify(status="nok", message="Debe aparecer un solo rostro válido."), 422
            probe = np.asarray(getattr(faces[0], "embedding", []), dtype=np.float32).reshape(-1)
            if probe.size == 0 or not np.all(np.isfinite(probe)) or np.linalg.norm(probe) <= 0:
                return jsonify(status="nok", message="No se pudo identificar el rostro."), 422
            probe = probe / np.linalg.norm(probe)
            results = []
            for candidate in candidates:
                try:
                    vectors = []
                    templates = candidate.get("templates")
                    if not isinstance(templates, list) or not 1 <= len(templates) <= 3:
                        raise ValueError("Catálogo de capturas inválido.")
                    for template in templates:
                        embeddings = template.get("embeddings") or {}
                        if not embeddings:
                            raise ValueError("Plantilla sin vector.")
                        for value in embeddings.values():
                            vector = np.asarray(value, dtype=np.float32).reshape(-1)
                            if vector.size != probe.size or not np.all(np.isfinite(vector)) or np.linalg.norm(vector) <= 0:
                                raise ValueError("Vector incompatible.")
                            vectors.append(vector / np.linalg.norm(vector))
                    similarity = float(np.clip(np.max(np.asarray(vectors) @ probe), 0, 1))
                    results.append(dict(id=candidate["id"], similarity=similarity, verified=similarity >= threshold))
                except (ValueError, TypeError, AttributeError):
                    results.append(dict(id=candidate["id"], similarity=0, verified=False, error="Plantilla incompatible; revise el catálogo."))
            return jsonify(status="ok", threshold=threshold, facesDetected=1, results=results, elapsedMs=round((time.perf_counter() - started) * 1000, 1))
        except (ValueError, TypeError, AttributeError):
            return jsonify(status="nok", message="Solicitud facial inválida."), 400
        except Exception:
            return jsonify(status="nok", message="No se completó la identificación facial."), 503
