import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.service import predict

router = APIRouter(prefix="/api/v1/nlp", tags=["spam-detector"])


class TextInput(BaseModel):
    text: str


class BatchInput(BaseModel):
    texts: list[str]


@router.post("/predict")
async def predict_single(body: TextInput):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, predict, body.text)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict/batch")
async def predict_batch(body: BatchInput):
    if not body.texts:
        raise HTTPException(status_code=400, detail="texts list cannot be empty")
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: [predict(t) for t in body.texts])
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
