# GCP Deployment Guide — Project 04 Spam Detection System

---

## GCP Services for Spam Detection

### 1. Ready-to-Use AI (No Model Needed)

| Service                              | What it does                                                                 | When to use                                        |
|--------------------------------------|------------------------------------------------------------------------------|----------------------------------------------------|
| **Cloud Natural Language API**       | Classify text content — detect spam signals in messages                      | Replace your entire nlp-service with one API call  |
| **Vertex AI AutoML Text**            | Custom text classification trained on your spam/ham labels                   | When you need domain-specific spam detection       |
| **Vertex AI Gemini**                 | Gemini Pro for nuanced spam detection via prompt                             | When rule-based signals are insufficient           |

> **Vertex AI AutoML Text Classification** trained on your SMS Spam Collection dataset is the direct replacement for your NLTK + Naive Bayes model.

### 2. Host Your Own Model (Keep Current Stack)

| Service                    | What it does                                                        | When to use                                           |
|----------------------------|---------------------------------------------------------------------|-------------------------------------------------------|
| **Cloud Run**              | Run backend + nlp-service containers — serverless, scales to zero   | Best match for your current microservice architecture |
| **Google Kubernetes Engine** | Full Kubernetes for your 3 services                               | When you need auto-scaling at production scale        |
| **Artifact Registry**      | Store your Docker images                                            | Used with Cloud Run or GKE                            |

### 3. Train and Manage Your Model

| Service                      | What it does                                                              | When to use                                           |
|------------------------------|---------------------------------------------------------------------------|-------------------------------------------------------|
| **Vertex AI**                | Train, track experiments, register models, deploy managed endpoints       | Upgrade your train.py to a full ML pipeline           |
| **Vertex AI Endpoints**      | Serve your model.pkl as a REST endpoint                                   | Replace nlp-service with a managed inference endpoint |

### 4. Frontend Hosting

| Service                    | What it does                                                              |
|----------------------------|---------------------------------------------------------------------------|
| **Firebase Hosting**       | Host your React frontend — free tier, auto CI/CD from GitHub              |
| **Cloud CDN**              | Serve static assets globally with low latency                             |

### 5. Supporting Services

| Service                        | Purpose                                                                   |
|--------------------------------|---------------------------------------------------------------------------|
| **Cloud Endpoints / Apigee**   | Rate limiting, auth, monitoring for your /api/v1/predict endpoint         |
| **Cloud Monitoring + Logging** | Track spam detection latency, false positive rates, request volume        |
| **Secret Manager**             | Store API keys and connection strings instead of .env files               |
| **Cloud Storage**              | Store model.pkl / vectorizer.pkl so containers load models from cloud     |

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Firebase Hosting — React Frontend                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│  Cloud Run — Backend (FastAPI :8000)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal HTTPS
        ┌──────────────┴──────────────┐
        │ Option A                    │ Option B
        ▼                             ▼
┌───────────────────┐    ┌────────────────────────────┐
│ Cloud Run         │    │ Vertex AI AutoML Text       │
│ NLP Service :8001 │    │ Custom Classification       │
│ NLTK + NaiveBayes │    │ No model maintenance needed │
└───────────────────┘    └────────────────────────────┘
```

---

## Prerequisites

```bash
gcloud auth login
gcloud projects create spamdetection-project --name="Spam Detection"
gcloud config set project spamdetection-project
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com language.googleapis.com \
  storage.googleapis.com aiplatform.googleapis.com cloudbuild.googleapis.com
```

---

## Step 1 — Create Artifact Registry and Push Images

```bash
GCP_REGION=europe-west2
gcloud artifacts repositories create spamdetection-repo \
  --repository-format=docker --location=$GCP_REGION
gcloud auth configure-docker $GCP_REGION-docker.pkg.dev
AR=$GCP_REGION-docker.pkg.dev/spamdetection-project/spamdetection-repo
docker build -f docker/Dockerfile.nlp-service -t $AR/nlp-service:latest ./nlp-service
docker push $AR/nlp-service:latest
docker build -f docker/Dockerfile.backend -t $AR/backend:latest ./backend
docker push $AR/backend:latest
```

---

## Step 2 — Upload Models to Cloud Storage

```bash
gsutil mb -l $GCP_REGION gs://spam-models-spamdetection-project
gsutil cp nlp-service/models/model.pkl gs://spam-models-spamdetection-project/models/model.pkl
gsutil cp nlp-service/models/vectorizer.pkl gs://spam-models-spamdetection-project/models/vectorizer.pkl
```

---

## Step 3 — Deploy to Cloud Run

```bash
gcloud run deploy nlp-service \
  --image $AR/nlp-service:latest --region $GCP_REGION \
  --port 8001 --no-allow-unauthenticated \
  --min-instances 1 --max-instances 3 --memory 1Gi --cpu 1

NLP_URL=$(gcloud run services describe nlp-service --region $GCP_REGION --format "value(status.url)")

gcloud run deploy backend \
  --image $AR/backend:latest --region $GCP_REGION \
  --port 8000 --allow-unauthenticated \
  --min-instances 1 --max-instances 5 --memory 1Gi --cpu 1 \
  --set-env-vars NLP_SERVICE_URL=$NLP_URL
```

---

## Option B — Use Vertex AI AutoML Text Classification

```python
from google.cloud import aiplatform

aiplatform.init(project="spamdetection-project", location="europe-west2")

endpoint = aiplatform.Endpoint("projects/spamdetection-project/locations/europe-west2/endpoints/<endpoint-id>")

def predict(text: str) -> dict:
    instances = [{"content": text}]
    prediction = endpoint.predict(instances=instances)
    top = max(prediction.predictions[0]["displayNames"],
              key=lambda x: prediction.predictions[0]["confidences"][prediction.predictions[0]["displayNames"].index(x)])
    confidence = max(prediction.predictions[0]["confidences"])
    return {"label": top.lower(), "confidence": round(confidence * 100, 2)}
```

Add to requirements.txt: `google-cloud-aiplatform>=1.50.0`

---

## CI/CD — GitHub Actions

```yaml
name: Deploy to GCP
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker europe-west2-docker.pkg.dev
      - run: |
          docker build -f docker/Dockerfile.backend \
            -t europe-west2-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/spamdetection-repo/backend:${{ github.sha }} ./backend
          docker push europe-west2-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/spamdetection-repo/backend:${{ github.sha }}
          gcloud run deploy backend \
            --image europe-west2-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/spamdetection-repo/backend:${{ github.sha }} \
            --region europe-west2 --platform managed
```

---

## Estimated Monthly Cost

| Service                    | Tier                  | Est. Cost          |
|----------------------------|-----------------------|--------------------|
| Cloud Run (backend)        | 1 vCPU / 1 GB         | ~$10–15/month      |
| Cloud Run (nlp-service)    | 1 vCPU / 1 GB         | ~$10–15/month      |
| Artifact Registry          | Storage               | ~$1–2/month        |
| Firebase Hosting           | Free tier             | $0                 |
| Cloud Storage (models)     | Standard              | ~$1/month          |
| Vertex AI AutoML           | Pay per node hour     | Pay per use        |
| **Total (Option A)**       |                       | **~$22–33/month**  |
| **Total (Option B)**       |                       | **~$12–18/month**  |

For exact estimates → https://cloud.google.com/products/calculator

---

## Teardown

```bash
gcloud run services delete backend --region $GCP_REGION --quiet
gcloud run services delete nlp-service --region $GCP_REGION --quiet
gcloud artifacts repositories delete spamdetection-repo --location=$GCP_REGION --quiet
gsutil rm -r gs://spam-models-spamdetection-project
gcloud projects delete spamdetection-project
```
