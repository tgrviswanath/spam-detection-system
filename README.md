# Project 04 - Spam Detection System

Microservice NLP project that classifies messages as **spam** or **ham** using NLTK + Naive Bayes.

## Architecture

```
Frontend :3000  →  Backend :8000  →  NLP Service :8001
  React/MUI        FastAPI/httpx      FastAPI/NLTK/sklearn
```

## Local Run

```bash
# Terminal 1 - NLP Service
cd nlp-service && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
python train.py
uvicorn app.main:app --reload --port 8001

# Terminal 2 - Backend
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 3 - Frontend
cd frontend && npm install && npm start
```

## Docker

```bash
docker-compose up --build
```

## Stack

| Layer | Tools |
|-------|-------|
| NLP Service | NLTK, scikit-learn (MultinomialNB), TF-IDF |
| Backend | FastAPI, httpx |
| Frontend | React, MUI, Recharts |
| Dataset | SMS Spam Collection (5,574 messages) |

## Features

- Single message check with confidence bars
- Batch check (one message per line) with summary chart + results table
- Quick example messages to test
