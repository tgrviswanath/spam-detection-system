import pytest
from unittest.mock import patch, MagicMock
from app.core.preprocess import clean_text


def test_clean_text_removes_stopwords():
    result = clean_text("This is a free prize win now")
    assert "is" not in result
    assert "this" not in result


def test_clean_text_lowercases():
    result = clean_text("FREE PRIZE")
    assert result == result.lower()


def test_clean_text_removes_punctuation():
    result = clean_text("Hello, world!")
    assert "," not in result
    assert "!" not in result


@patch("app.core.service.joblib.load")
def test_predict_spam(mock_load):
    mock_model = MagicMock()
    mock_model.predict.return_value = ["spam"]
    mock_model.predict_proba.return_value = [[0.1, 0.9]]
    mock_model.classes_ = ["ham", "spam"]
    mock_vectorizer = MagicMock()
    mock_vectorizer.transform.return_value = MagicMock()
    mock_load.side_effect = [mock_model, mock_vectorizer]

    from app.core import service
    service._model = mock_model
    service._vectorizer = mock_vectorizer

    result = service.predict("Win a free prize now!")
    assert result["label"] == "spam"
    assert result["is_spam"] is True
    assert 0 <= result["confidence"] <= 1
