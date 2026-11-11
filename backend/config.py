import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/travel_mini")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "travelmini_super_secret_key_2026")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 86400)))
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"
