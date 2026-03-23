from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.service import predict, predict_batch
import httpx

router = APIRouter(prefix="/api/v1", tags=["spam"])


class TextInput(BaseModel):
    text: str


class BatchInput(BaseModel):
    texts: list[str]


@router.post("/predict")
async def predict_single(body: TextInput):
    try:
        return await predict(body.text)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="NLP service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


@router.post("/predict/batch")
async def predict_batch_route(body: BatchInput):
    try:
        return await predict_batch(body.texts)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="NLP service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
