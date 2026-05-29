import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from config import settings
from routers import auth, books, users, isbn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bibliotrack")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warn loudly if insecure default SECRET_KEY is in use
    if settings.is_insecure_default_key:
        logger.warning(
            "⚠️  SECRET_KEY is using the insecure default value. "
            "Set a strong SECRET_KEY via environment variable before exposing this service."
        )

    Base.metadata.create_all(bind=engine)
    settings.COVERS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="BiblioTrack", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_static_dir = Path(__file__).parent / "static"
_static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(users.router)
app.include_router(isbn.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}
