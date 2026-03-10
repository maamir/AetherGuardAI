FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install "cython<3.0.0" wheel && \
pip install "pyyaml==5.4.1" --no-build-isolation && \
pip install --no-cache-dir -r requirements.txt && \
    python -m spacy download en_core_web_sm

COPY . .

EXPOSE 8001
CMD ["python", "main.py"]
