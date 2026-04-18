from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from engine import (
    analyze_media,
    analyze_media_against_candidates,
    analyze_media_url_against_candidates,
    analyze_media_with_index,
    analyze_url_with_index,
    extract_video_frames,
    get_dataset_index_stats,
    generate_embedding,
    generate_image_hash,
    rebuild_dataset_index,
)


class Candidate(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    url: Optional[str] = None
    fingerprint: Optional[str] = None
    file_type: Optional[str] = None


class AnalyzeRequest(BaseModel):
    input_file: Optional[str] = Field(default=None, description="Local image/video path")
    dataset_folder: Optional[str] = Field(default=None, description="Local dataset folder path")
    file_url: Optional[str] = Field(default=None, description="Remote image URL")
    file_type: Optional[str] = Field(default=None, description="MIME type for input URL")
    threshold: float = 80.0
    candidates: List[Candidate] = []
    use_index: bool = False
    top_k: int = 25


app = FastAPI(title="Vigil AI Service", version="1.0.0")


class IndexRequest(BaseModel):
    dataset_folder: str


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "vigil-ai", "version": "1.0.0"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> Dict[str, Any]:
    """Analyze input media and return best similarity match.

    Supports two modes:
    1) Local mode: input_file + dataset_folder
    2) URL mode: file_url + candidates
    """
    try:
        if req.input_file and req.dataset_folder:
            if not os.path.exists(req.input_file):
                raise HTTPException(status_code=400, detail="input_file does not exist")
            if not os.path.isdir(req.dataset_folder):
                raise HTTPException(status_code=400, detail="dataset_folder does not exist")

            if req.use_index:
                result = analyze_media_with_index(
                    req.input_file,
                    req.dataset_folder,
                    threshold=req.threshold,
                    top_k=req.top_k,
                )
            else:
                result = analyze_media(req.input_file, req.dataset_folder, threshold=req.threshold)
            return result

        if req.file_url:
            candidate_result = analyze_media_url_against_candidates(
                input_url=req.file_url,
                candidates=[c.model_dump() for c in req.candidates],
                threshold=req.threshold,
                input_file_type=req.file_type,
            )

            best_result = candidate_result

            if req.dataset_folder and os.path.isdir(req.dataset_folder):
                if req.use_index:
                    dataset_result = analyze_url_with_index(
                        input_url=req.file_url,
                        dataset_folder=req.dataset_folder,
                        threshold=req.threshold,
                        top_k=req.top_k,
                        input_file_type=req.file_type,
                    )
                else:
                    parsed = urlparse(req.file_url)
                    suffix = os.path.splitext(parsed.path)[1] or ".jpg"

                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp_path = tmp.name

                    try:
                        import requests

                        media_resp = requests.get(req.file_url, timeout=15)
                        media_resp.raise_for_status()
                        with open(tmp_path, "wb") as f:
                            f.write(media_resp.content)

                        dataset_result = analyze_media(
                            input_file=tmp_path,
                            dataset_folder=req.dataset_folder,
                            threshold=req.threshold,
                        )
                    finally:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)

                if dataset_result.get("similarity", 0) > best_result.get("similarity", 0):
                    best_result = dataset_result

            return best_result

        raise HTTPException(status_code=400, detail="Provide either input_file+dataset_folder or file_url")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/analyze/batch")
def analyze_batch(requests_payload: List[AnalyzeRequest]) -> Dict[str, Any]:
    results = []
    for req in requests_payload:
        try:
            results.append(analyze(req))
        except Exception as exc:
            results.append({"status": "ERROR", "detail": str(exc)})
    return {"results": results, "count": len(results)}


@app.get("/functions")
def available_functions() -> Dict[str, Any]:
    """Expose required core functions for quick verification."""
    return {
        "functions": [
            "generate_image_hash(image_path)",
            "extract_video_frames(video_path)",
            "generate_embedding(image)",
            "compare_hashes(hash1, hash2)",
            "compare_embeddings(vec1, vec2)",
            "analyze_media(input_file, dataset_folder)",
        ]
    }


@app.post("/index/rebuild")
def index_rebuild(req: IndexRequest) -> Dict[str, Any]:
    if not os.path.isdir(req.dataset_folder):
        raise HTTPException(status_code=400, detail="dataset_folder does not exist")
    return rebuild_dataset_index(req.dataset_folder)


@app.get("/index/stats")
def index_stats() -> Dict[str, Any]:
    return get_dataset_index_stats()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8080"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
