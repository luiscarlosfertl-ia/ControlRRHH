FROM python:3.12-slim-bookworm AS wheels
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir numpy==2.2.6 Cython==3.2.4 setuptools==80.9.0 wheel==0.45.1 && pip wheel --no-cache-dir --no-build-isolation --wheel-dir=/wheels -r requirements.txt

FROM python:3.12-slim-bookworm
LABEL org.opencontainers.image.source="https://github.com/luiscarlosfertl-ia/ControlRRHH"
LABEL org.opencontainers.image.title="ControlRRHH FaceVision"
LABEL org.opencontainers.image.description="Runtime facial RRHH CPU con modelos buffalo_l; no incluye biometría ni secretos"
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 10001 face
COPY --from=wheels /wheels /wheels
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /tmp/requirements.txt && rm -rf /wheels
ENV HOME=/home/face
# Los pesos se descargan durante el build y quedan dentro de la imagen. Ningún
# equipo usuario descarga modelos al iniciar el servicio.
RUN python -c "from insightface.utils import storage; storage.ensure_available('models', 'buffalo_l', root='/home/face/.insightface')" \
 && test -f /home/face/.insightface/models/buffalo_l/det_10g.onnx \
 && test -f /home/face/.insightface/models/buffalo_l/w600k_r50.onnx \
 && chown -R face:face /home/face/.insightface
WORKDIR /app
COPY hr_runtime.py hr_fast_face.py source-manifest.json ./
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 MPLCONFIGDIR=/tmp/matplotlib
USER face
EXPOSE 8007
CMD ["gunicorn", "--bind", "0.0.0.0:8007", "--workers", "1", "--threads", "2", "--timeout", "120", "--access-logfile", "/dev/null", "hr_runtime:app"]
