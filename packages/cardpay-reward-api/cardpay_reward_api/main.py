import os
from typing import List, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi_utils.tasks import repeat_every
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import SessionLocal, engine, get_db, get_fastapi_sessionmaker
from .indexer import Indexer

load_dotenv()

models.Base.metadata.create_all(bind=engine)
for expected_env in [
    "SUBGRAPH_URL",
    "REWARDS_BUCKET",
    "PORT",
]:
    if expected_env not in os.environ:
        raise ValueError(f"Missing environment variable {expected_env}")

SUBGRAPH_URL = os.environ.get("SUBGRAPH_URL")
REWARDS_BUCKET = os.environ.get("REWARDS_BUCKET")
PORT = int(os.environ.get("PORT"))

app = FastAPI()


@app.on_event("startup")
@repeat_every(seconds=60)  # 1 hour
def index_root_task() -> None:
    sessionmaker = get_fastapi_sessionmaker()
    with sessionmaker.context_session() as db:
        try:
            Indexer(SUBGRAPH_URL).run(db=db, storage_location=REWARDS_BUCKET)
        except Exception as e:
            print(e)


def param(skip: int = 0, limit: int = 100):
    return {"skip": skip, "limit": limit}


@app.get("/about/")
async def about():
    return {
        "subgraph_url": SUBGRAPH_URL,
        "rewards_bucket": REWARDS_BUCKET,
    }


@app.get("/merkle-proofs/{payee}", response_model=List[schemas.Proof])
def read_proofs(
    db: Session = Depends(get_db),
    proof_filter: dict = Depends(schemas.ProofFilter),
    param: dict = Depends(param),
):
    return crud.get_proofs(db, proof_filter=proof_filter, param=param)


if __name__ == "__main__":
    uvicorn.run("cardpay_reward_api.main:app", host="0.0.0.0", log_level="info")
