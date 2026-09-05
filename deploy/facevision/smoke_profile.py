"""Real model load + synthetic blank-image contract; no faces/captures persisted."""
import importlib.util
from pathlib import Path
import sys
import base64
import cv2
import numpy as np

folder = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(folder))
spec = importlib.util.spec_from_file_location("hr_runtime", folder / "hr_runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
client = module.app.test_client()
assert client.get("/health").status_code == 200
ok, encoded = cv2.imencode(".jpg", np.zeros((384, 512, 3), np.uint8))
assert ok
body = {"captures": {"near": "data:image/jpeg;base64," + base64.b64encode(encoded).decode()}}
assert client.post("/face-auth/detect", json=body).json["facesDetected"] == 0
assert client.post("/face-auth/enroll", json=body).status_code == 422
assert client.post("/face-auth/search", json={**body, "threshold": .72, "candidates": []}).status_code == 422
assert client.get("/iniciaSesion").status_code == 404
assert client.get("/qa").status_code == 404
print("PASS: real CPU model ready; blank image never enrolls/identifies; non-HR routes absent.")
