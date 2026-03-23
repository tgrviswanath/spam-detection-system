import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@patch("app.core.service.predict", new_callable=AsyncMock)
def test_predict_endpoint(mock_predict):
    mock_predict.return_value = {
        "label": "spam", "is_spam": True,
        "confidence": 0.95, "scores": {"ham": 0.05, "spam": 0.95}
    }
    response = client.post("/api/v1/predict", json={"text": "Win a free prize!"})
    assert response.status_code == 200
    data = response.json()
    assert data["is_spam"] is True


def test_predict_empty_text():
    response = client.post("/api/v1/predict", json={"text": ""})
    assert response.status_code in (400, 422, 503)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
