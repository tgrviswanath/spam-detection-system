from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SERVICE_NAME: str = "NLP Spam Detection Service"
    SERVICE_VERSION: str = "1.0.0"
    SERVICE_PORT: int = 8001

    class Config:
        env_file = ".env"


settings = Settings()
