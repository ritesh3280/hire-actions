from datetime import datetime
from typing import Annotated, Any, List
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field, BeforeValidator


def _validate_object_id(v: Any) -> ObjectId:
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str):
        try:
            return ObjectId(v)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Invalid ObjectId") from exc
    raise TypeError("ObjectId required")


PyObjectId = Annotated[ObjectId, BeforeValidator(_validate_object_id)]


class CandidateCreate(BaseModel):
    name: str
    email: EmailStr
    pipeline_stage: str | None = None
    priority: str | None = None


class CandidateDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    short_id: int | None = None
    name: str
    email: EmailStr
    resume_text: str
    embedding_768: List[float]
    pipeline_stage: str | None = None
    priority: str | None = None
    score_history: list[dict[str, Any]] = []
    notes: list[dict[str, Any]] = []
    stage_history: list[dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime | None = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class CandidateOut(BaseModel):
    id: str
    short_id: int | None = None
    name: str
    email: EmailStr
    resume_text: str
    embedding_768: List[float]
    pipeline_stage: str | None = None
    priority: str | None = None
    score_history: list[dict[str, Any]] = []
    created_at: datetime


class JobCreate(BaseModel):
    title: str
    description: str


class JobDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    short_id: int | None = None
    title: str
    description: str
    required_skills: list[str]
    embedding_768: List[float]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class JobOut(BaseModel):
    id: str
    short_id: int | None = None
    title: str
    description: str
    required_skills: list[str]
    embedding_768: List[float]
    created_at: datetime


class ActionLogDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    action_type: str
    params: dict[str, Any]
    status: str
    output: dict[str, Any] | None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class ActionLogOut(BaseModel):
    id: str
    action_type: str
    params: dict[str, Any]
    status: str
    output: dict[str, Any] | None
    created_at: datetime
