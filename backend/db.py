from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument
from config import get_settings

_settings = get_settings()
_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def get_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(_settings.mongo_uri)
        _db = _client[_settings.mongo_db]
        await _ensure_indexes(_db)
    return _db


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.candidates.create_index([("email", ASCENDING)], unique=True, sparse=True)
    await db.candidates.create_index([("name", ASCENDING)])
    await db.candidates.create_index([("pipeline_stage", ASCENDING)])
    await db.candidates.create_index([("short_id", ASCENDING)], unique=True, sparse=True)
    await db.jobs.create_index([("title", ASCENDING)])
    await db.jobs.create_index([("short_id", ASCENDING)], unique=True, sparse=True)
    await db.action_logs.create_index([("action_type", ASCENDING), ("created_at", ASCENDING)])


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def get_next_short_id(db: AsyncIOMotorDatabase, counter_name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(doc["seq"])
