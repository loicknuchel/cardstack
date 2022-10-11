import json
import logging
import os
from typing import List

import requests
import sentry_sdk
import uvicorn
from did_resolver import Resolver
from fastapi import Depends, FastAPI
from python_did_resolver import get_resolver
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from web3 import Web3

from . import crud, schemas
from .config import config, get_settings

LOGLEVEL = os.environ.get("LOGLEVEL", "INFO").upper()
logging.basicConfig(level=LOGLEVEL)

settings = get_settings()
engine = create_engine(settings.DB_STRING)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI()


def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_w3():
    w3 = Web3(Web3.HTTPProvider(settings.EVM_FULL_NODE_URL))
    yield w3


def get_reward_pool(w3=Depends(get_w3)):
    with open("abis/RewardPool.json") as contract_file:
        contract = json.load(contract_file)
    reward_contract = w3.eth.contract(
        address=config[settings.ENVIRONMENT]["reward_pool"], abi=contract["abi"]
    )
    yield reward_contract


def get_reward_manager(w3=Depends(get_w3)):
    with open("abis/RewardManager.json") as contract_file:
        contract = json.load(contract_file)
    reward_contract = w3.eth.contract(
        address=config[settings.ENVIRONMENT]["reward_manager"], abi=contract["abi"]
    )
    yield reward_contract


if settings.SENTRY_DSN is not None:
    sentry_sdk.init(
        settings.SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0,
        environment=settings.ENVIRONMENT,
    )


def param(skip: int = 0, limit: int = 100):
    return {"skip": skip, "limit": limit}


@app.get("/about/")
async def about():
    return {
        "subgraph_url": settings.SUBGRAPH_URL,
        "rewards_bucket": settings.REWARDS_BUCKET,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/")
async def root():
    return {"status": "ok"}


@app.get("/merkle-proofs/{payee}", response_model=List[schemas.Proof])
def read_proofs(
    db: Session = Depends(get_db),
    proof_filter: dict = Depends(schemas.ProofFilter),
    param: dict = Depends(param),
):
    return crud.get_proofs(db, proof_filter=proof_filter, param=param)


@app.get(
    "/reward-pool-balance/{rewardProgramId}/{token}",
    response_model=schemas.RewardPoolBalance,
)
def read_reward_pool_balance(
    rewardProgramId: str,
    token: str,
    reward_pool=Depends(get_reward_pool),
):
    balance_in_wei = reward_pool.caller.rewardBalance(rewardProgramId, token)
    return {
        "rewardProgramId": rewardProgramId,
        "token": token,
        "balanceInEth": Web3.fromWei(balance_in_wei, "ether"),
    }


S3_STORAGE_LOCATION = "s3://"


@app.get("/rule/{rewardProgramId}")
def read_rule(
    rewardProgramId: str,
    reward_manager=Depends(get_reward_manager),
):

    json_object = get_rule(reward_manager, rewardProgramId)
    return json_object


def resolve_rule(did: str):
    url = Resolver(get_resolver()).resolve(did)["didDocument"]["alsoKnownAs"][0]
    return requests.get(url).json()


def get_rule(reward_manager, reward_program_id):
    # stub
    did = "did:cardstack:1rkdiBistMpm4fThbFLCixx5798f022dbb7697ce"
    rule = resolve_rule(did)
    return rule
    blob = reward_manager.caller.rule(reward_program_id)
    if blob and blob != b"":
        try:
            did = blob.decode("utf-8")  # new blob format: hex encodes a did string
            did = "did:cardstack:1rkdiBistMpm4fThbFLCixx5798f022dbb7697ce"
            rules = resolve_rule(did)
        except Exception:
            # old blob format: our rule blobs were hex encoded json
            # try..except maintains backward compatibality with our old blob format
            # TODO: remove code once all reward programs have the old rule /blob removed
            rules = json.loads(blob)
        if type(rules) == list:
            return rules
        else:
            return [rules]
    else:
        return []


if __name__ == "__main__":
    uvicorn.run("cardpay_reward_api.main:app", host="0.0.0.0", log_level="info")
