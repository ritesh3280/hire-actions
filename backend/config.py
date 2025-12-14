from functools import lru_cache
from os.path import dirname, join
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from dotenv import load_dotenv, find_dotenv

# Load environment variables from the nearest .env up the tree (project root).
_dotenv_path = find_dotenv(usecwd=True) or join(dirname(__file__), "..", ".env")
load_dotenv(_dotenv_path)


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "hireflow"
    openai_api_key: str | None = None
    gmail_client_id: str | None = None
    gmail_client_secret: str | None = None
    gmail_refresh_token: str | None = None
    gmail_sender: str | None = None
    gmail_enabled: bool = False
    llm_model: str = "gpt-3.5-turbo"
    embedding_model: str = "all-mpnet-base-v2"

    class Config:
        env_file = ".env"
        extra = "ignore"


class GmailConfig(BaseModel):
    client_id: str | None
    client_secret: str | None
    refresh_token: str | None
    sender: str | None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
