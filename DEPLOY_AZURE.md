# Azure Deployment Guide — Project 04 Spam Detection System

---

## Azure Services for Spam Detection

### 1. Ready-to-Use AI (No Model Needed)

| Service                              | What it does                                                                 | When to use                                        |
|--------------------------------------|------------------------------------------------------------------------------|----------------------------------------------------|
| **Azure AI Content Safety**          | Detect harmful, spam, and unwanted content in text                           | Replace your entire nlp-service with one API call  |
| **Azure AI Language**                | Custom text classification trained on your spam/ham labels                   | When you need domain-specific spam detection       |
| **Azure OpenAI Service**             | GPT-4 for nuanced spam detection via prompt                                  | When rule-based signals are insufficient           |

> **Azure AI Content Safety** provides built-in spam and harmful content detection. For SMS-style spam, **Azure AI Language Custom Classification** trained on your SMS Spam Collection dataset is the most accurate replacement.

### 2. Host Your Own Model (Keep Current Stack)

| Service                        | What it does                                                        | When to use                                           |
|--------------------------------|---------------------------------------------------------------------|-------------------------------------------------------|
| **Azure Container Apps**       | Run your 3 Docker containers (frontend, backend, nlp-service)       | Best match for your current microservice architecture |
| **Azure App Service**          | Host FastAPI backend + nlp-service as web apps                      | Simple deployment, no containers needed               |
| **Azure Container Registry**   | Store your Docker images                                            | Used with Container Apps or AKS                       |

### 3. Train and Manage Your Model

| Service                        | What it does                                                              | When to use                                           |
|--------------------------------|---------------------------------------------------------------------------|-------------------------------------------------------|
| **Azure Machine Learning**     | Train, track, register, and deploy your Naive Bayes model                 | Upgrade your train.py to a full ML pipeline           |
| **Azure ML Managed Endpoints** | Serve your model.pkl as a REST endpoint                                   | Replace nlp-service with a managed inference endpoint |

### 4. Frontend Hosting

| Service                   | What it does                                                               |
|---------------------------|----------------------------------------------------------------------------|
| **Azure Static Web Apps** | Host your React frontend — free tier available, auto CI/CD from GitHub     |
| **Azure CDN**             | Serve static assets globally with low latency                              |

### 5. Supporting Services

| Service                       | Purpose                                                                  |
|-------------------------------|--------------------------------------------------------------------------|
| **Azure API Management**      | Rate limiting, auth, monitoring for your /api/v1/predict endpoint        |
| **Azure Monitor + App Insights** | Track spam detection latency, false positive rates, request volume    |
| **Azure Key Vault**           | Store API keys and connection strings instead of .env files              |
| **Azure Blob Storage**        | Store model.pkl / vectorizer.pkl so containers load models from cloud    |

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Static Web Apps — React Frontend                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│  Azure Container Apps — Backend (FastAPI :8000)             │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal
        ┌──────────────┴──────────────┐
        │ Option A                    │ Option B
        ▼                             ▼
┌───────────────────┐    ┌────────────────────────────┐
│ Container Apps    │    │ Azure AI Content Safety     │
│ NLP Service :8001 │    │ + Azure AI Language         │
│ NLTK + NaiveBayes │    │ No model maintenance needed │
└───────────────────┘    └────────────────────────────┘
```

---

## Prerequisites

```bash
az login
az group create --name rg-spam-detection --location uksouth
az extension add --name containerapp --upgrade
```

---

## Step 1 — Create Container Registry and Push Images

```bash
az acr create --resource-group rg-spam-detection --name spamdetectionacr --sku Basic --admin-enabled true
az acr login --name spamdetectionacr
ACR=spamdetectionacr.azurecr.io
docker build -f docker/Dockerfile.nlp-service -t $ACR/nlp-service:latest ./nlp-service
docker push $ACR/nlp-service:latest
docker build -f docker/Dockerfile.backend -t $ACR/backend:latest ./backend
docker push $ACR/backend:latest
```

---

## Step 2 — Upload Model to Blob Storage

```bash
az storage account create --name spammodels --resource-group rg-spam-detection --sku Standard_LRS
az storage container create --name models --account-name spammodels
az storage blob upload --account-name spammodels --container-name models --name model.pkl --file nlp-service/models/model.pkl
az storage blob upload --account-name spammodels --container-name models --name vectorizer.pkl --file nlp-service/models/vectorizer.pkl
```

---

## Step 3 — Deploy Container Apps

```bash
az containerapp env create --name spam-env --resource-group rg-spam-detection --location uksouth

az containerapp create \
  --name nlp-service --resource-group rg-spam-detection \
  --environment spam-env --image $ACR/nlp-service:latest \
  --registry-server $ACR --target-port 8001 --ingress internal \
  --min-replicas 1 --max-replicas 3 --cpu 0.5 --memory 1.0Gi

az containerapp create \
  --name backend --resource-group rg-spam-detection \
  --environment spam-env --image $ACR/backend:latest \
  --registry-server $ACR --target-port 8000 --ingress external \
  --min-replicas 1 --max-replicas 5 --cpu 0.5 --memory 1.0Gi \
  --env-vars NLP_SERVICE_URL=http://nlp-service:8001
```

---

## Option B — Use Azure AI Content Safety

```bash
az cognitiveservices account create \
  --name spam-content-safety \
  --resource-group rg-spam-detection \
  --kind ContentSafety \
  --sku S0 \
  --location uksouth \
  --yes
```

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.core.credentials import AzureKeyCredential
from azure.ai.contentsafety.models import AnalyzeTextOptions

client = ContentSafetyClient(
    endpoint=os.getenv("AZURE_CONTENT_SAFETY_ENDPOINT"),
    credential=AzureKeyCredential(os.getenv("AZURE_CONTENT_SAFETY_KEY"))
)

def predict(text: str) -> dict:
    request = AnalyzeTextOptions(text=text)
    result = client.analyze_text(request)
    is_spam = any(cat.severity > 2 for cat in result.categories_analysis)
    return {"label": "spam" if is_spam else "ham", "confidence": 85.0}
```

Add to requirements.txt: `azure-ai-contentsafety>=1.0.0`

---

## CI/CD — GitHub Actions

```yaml
name: Deploy to Azure
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - run: az acr login --name spamdetectionacr
      - run: |
          docker build -f docker/Dockerfile.backend -t spamdetectionacr.azurecr.io/backend:${{ github.sha }} ./backend
          docker push spamdetectionacr.azurecr.io/backend:${{ github.sha }}
          az containerapp update --name backend --resource-group rg-spam-detection \
            --image spamdetectionacr.azurecr.io/backend:${{ github.sha }}
```

---

## Estimated Monthly Cost

| Service                  | Tier      | Est. Cost         |
|--------------------------|-----------|-------------------|
| Container Apps (backend) | 0.5 vCPU  | ~$10–15/month     |
| Container Apps (nlp-svc) | 0.5 vCPU  | ~$10–15/month     |
| Container Registry       | Basic     | ~$5/month         |
| Static Web Apps          | Free      | $0                |
| Blob Storage             | LRS       | ~$1/month         |
| Content Safety           | S0 tier   | Pay per call      |
| **Total (Option A)**     |           | **~$26–36/month** |
| **Total (Option B)**     |           | **~$16–21/month** |

For exact estimates → https://calculator.azure.com

---

## Teardown

```bash
az group delete --name rg-spam-detection --yes --no-wait
```
