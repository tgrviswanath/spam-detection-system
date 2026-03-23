from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.service import predict

router = APIRouter(prefix="/api/v1/nlp", tags=["spam-detector"])


class TextInput(BaseModel):
    text: str


class BatchInput(BaseModel):
    texts: list[str]


@router.post("/predict")
def predict_single(body: TextInput):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")
    return predict(body.text)


@router.post("/predict/batch")
def predict_batch(body: BatchInput):
    if not body.texts:
        raise HTTPException(status_code=400, detail="texts list cannot be empty")
    return [predict(t) for t in body.texts]
