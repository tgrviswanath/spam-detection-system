# AWS Deployment Guide — Project 04 Spam Detection System

---

## AWS Services for Spam Detection

### 1. Ready-to-Use AI (No Model Needed)

| Service                    | What it does                                                                 | When to use                                        |
|----------------------------|------------------------------------------------------------------------------|----------------------------------------------------|
| **Amazon Comprehend**      | Custom text classification trained on your spam/ham labels                   | Replace your entire nlp-service with one API call  |
| **AWS Bedrock**            | Claude/Titan for nuanced spam detection via prompt                           | When rule-based signals are insufficient           |

> **Amazon Comprehend Custom Classification** trained on your SMS Spam Collection dataset is the direct replacement for your NLTK + Naive Bayes model.

### 2. Host Your Own Model (Keep Current Stack)

| Service                    | What it does                                                        | When to use                                           |
|----------------------------|---------------------------------------------------------------------|-------------------------------------------------------|
| **AWS App Runner**         | Run backend container — simplest, no VPC or cluster needed          | Quickest path to production                           |
| **Amazon ECS Fargate**     | Run backend + nlp-service containers in a private VPC               | Best match for your current microservice architecture |
| **Amazon ECR**             | Store your Docker images                                            | Used with App Runner, ECS, or EKS                     |

### 3. Train and Manage Your Model

| Service                         | What it does                                                        | When to use                                           |
|---------------------------------|---------------------------------------------------------------------|-------------------------------------------------------|
| **AWS SageMaker**               | Train, track, register, and deploy your Naive Bayes model           | Upgrade your train.py to a full ML pipeline           |
| **SageMaker Managed Endpoints** | Serve your model.pkl as a REST endpoint                             | Replace nlp-service with a managed inference endpoint |

### 4. Frontend Hosting

| Service               | What it does                                                                  |
|-----------------------|-------------------------------------------------------------------------------|
| **Amazon S3**         | Host your React build as a static website                                     |
| **Amazon CloudFront** | CDN in front of S3 — HTTPS, low latency globally                              |

### 5. Supporting Services

| Service                  | Purpose                                                                   |
|--------------------------|---------------------------------------------------------------------------|
| **AWS API Gateway**      | Rate limiting, auth, monitoring for your /api/v1/predict endpoint         |
| **Amazon CloudWatch**    | Track spam detection latency, false positive rates, request volume        |
| **AWS Secrets Manager**  | Store API keys and connection strings instead of .env files               |
| **Amazon S3 (models)**   | Store model.pkl / vectorizer.pkl so containers load models from cloud     |

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  S3 + CloudFront — React Frontend                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│  AWS App Runner / ECS Fargate — Backend (FastAPI :8000)     │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal
        ┌──────────────┴──────────────┐
        │ Option A                    │ Option B
        ▼                             ▼
┌───────────────────┐    ┌────────────────────────────┐
│ ECS Fargate       │    │ Amazon Comprehend           │
│ NLP Service :8001 │    │ Custom Classification       │
│ NLTK + NaiveBayes │    │ No model maintenance needed │
└───────────────────┘    └────────────────────────────┘
```

---

## Prerequisites

```bash
aws configure
AWS_REGION=eu-west-2
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

---

## Step 1 — Create ECR and Push Images

```bash
aws ecr create-repository --repository-name spamdetection/nlp-service --region $AWS_REGION
aws ecr create-repository --repository-name spamdetection/backend --region $AWS_REGION
ECR=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR
docker build -f docker/Dockerfile.nlp-service -t $ECR/spamdetection/nlp-service:latest ./nlp-service
docker push $ECR/spamdetection/nlp-service:latest
docker build -f docker/Dockerfile.backend -t $ECR/spamdetection/backend:latest ./backend
docker push $ECR/spamdetection/backend:latest
```

---

## Step 2 — Upload Models to S3

```bash
aws s3 mb s3://spam-models-$AWS_ACCOUNT --region $AWS_REGION
aws s3 cp nlp-service/models/model.pkl s3://spam-models-$AWS_ACCOUNT/models/model.pkl
aws s3 cp nlp-service/models/vectorizer.pkl s3://spam-models-$AWS_ACCOUNT/models/vectorizer.pkl
```

---

## Step 3 — Deploy with App Runner

```bash
aws apprunner create-service \
  --service-name spamdetection-backend \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'$ECR'/spamdetection/backend:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "NLP_SERVICE_URL": "http://nlp-service:8001"
        }
      }
    }
  }' \
  --instance-configuration '{"Cpu": "0.5 vCPU", "Memory": "1 GB"}' \
  --region $AWS_REGION
```

---

## Option B — Use Amazon Comprehend Custom Classification

```python
import boto3

comprehend = boto3.client("comprehend", region_name="eu-west-2")

def predict(text: str) -> dict:
    result = comprehend.classify_document(
        Text=text,
        EndpointArn="arn:aws:comprehend:eu-west-2:<account>:document-classifier-endpoint/spam-classifier"
    )
    top = max(result["Classes"], key=lambda x: x["Score"])
    label = "spam" if top["Name"].lower() == "spam" else "ham"
    return {"label": label, "confidence": round(top["Score"] * 100, 2)}
```

Add to requirements.txt: `boto3>=1.34.0`

---

## CI/CD — GitHub Actions

```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-2
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -f docker/Dockerfile.backend \
            -t ${{ secrets.ECR_REGISTRY }}/spamdetection/backend:${{ github.sha }} ./backend
          docker push ${{ secrets.ECR_REGISTRY }}/spamdetection/backend:${{ github.sha }}
```

---

## Estimated Monthly Cost

| Service                    | Tier              | Est. Cost          |
|----------------------------|-------------------|--------------------|
| App Runner (backend)       | 0.5 vCPU / 1 GB   | ~$15–20/month      |
| App Runner (nlp-service)   | 0.5 vCPU / 1 GB   | ~$15–20/month      |
| ECR                        | Storage           | ~$1–2/month        |
| S3 + CloudFront            | Standard          | ~$1–5/month        |
| Amazon Comprehend          | Custom classifier | Pay per call       |
| **Total (Option A)**       |                   | **~$32–47/month**  |
| **Total (Option B)**       |                   | **~$17–27/month**  |

For exact estimates → https://calculator.aws

---

## Teardown

```bash
aws ecr delete-repository --repository-name spamdetection/backend --force
aws ecr delete-repository --repository-name spamdetection/nlp-service --force
aws s3 rm s3://spam-models-$AWS_ACCOUNT --recursive
aws s3 rb s3://spam-models-$AWS_ACCOUNT
```
