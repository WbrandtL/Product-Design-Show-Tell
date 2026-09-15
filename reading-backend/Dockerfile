FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY samples ./samples
COPY static ./static

# GROQ_API_KEY, GROQ_MODEL and LLM_PROVIDER are set as secrets/env vars on
# the host (Render/Fly/Railway dashboard) - never baked into the image.
# Hosts inject $PORT; default to 8731 for a plain `docker run`.
ENV PORT=8731
EXPOSE 8731

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
