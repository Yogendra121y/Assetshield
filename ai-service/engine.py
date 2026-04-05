"""Core AI media matching engine for Vigil.

Implements perceptual hashing + embedding-based similarity for images and videos.
Designed for lightweight MVP usage with near-real-time performance.
"""

from __future__ import annotations

import io
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import cv2
import imagehash
import numpy as np
import requests
from PIL import Image
from sklearn.metrics.pairwise import cosine_similarity


SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

_SIG_CACHE: Dict[str, Tuple[float, Dict[str, object]]] = {}
_CACHE_TTL_SEC = 600
_CACHE_MAX_KEYS = 500


class DatasetVectorIndex:
    """Lightweight in-memory vector index for dataset retrieval.

    This is FAISS-style top-k retrieval behavior using normalized vectors and
    cosine dot products, without external native dependencies.
    """

    def __init__(self) -> None:
        self.dataset_folder: Optional[str] = None
        self.paths: List[str] = []
        self.names: List[str] = []
        self.embeddings: Optional[np.ndarray] = None
        self.signatures: Dict[str, Dict[str, object]] = {}

    def clear(self) -> None:
        self.dataset_folder = None
        self.paths = []
        self.names = []
        self.embeddings = None
        self.signatures = {}

    def build(self, dataset_folder: str) -> Dict[str, object]:
        self.clear()
        self.dataset_folder = dataset_folder

        vectors: List[np.ndarray] = []
        for candidate_file in _iter_dataset_files(dataset_folder):
            try:
                sig = _build_media_signature_from_file(candidate_file)
                rep = np.array(sig["representative_embedding"], dtype=np.float32)
                norm = np.linalg.norm(rep)
                if norm > 0:
                    rep = rep / norm

                vectors.append(rep)
                self.paths.append(candidate_file)
                self.names.append(os.path.basename(candidate_file))
                self.signatures[candidate_file] = sig
            except Exception:
                continue

        if vectors:
            self.embeddings = np.stack(vectors, axis=0)

        return {
            "dataset_folder": dataset_folder,
            "count": len(self.paths),
            "dimension": int(self.embeddings.shape[1]) if self.embeddings is not None else 0,
        }

    def ready(self) -> bool:
        return self.embeddings is not None and len(self.paths) > 0

    def stats(self) -> Dict[str, object]:
        return {
            "ready": self.ready(),
            "dataset_folder": self.dataset_folder,
            "count": len(self.paths),
            "dimension": int(self.embeddings.shape[1]) if self.embeddings is not None else 0,
        }

    def search(self, query_embedding: np.ndarray, top_k: int = 25) -> List[Dict[str, object]]:
        if not self.ready() or self.embeddings is None:
            return []

        q = np.array(query_embedding, dtype=np.float32)
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm

        sims = self.embeddings @ q
        k = max(1, min(top_k, sims.shape[0]))

        # Partial top-k selection for speed, then sort by score desc.
        idx = np.argpartition(sims, -k)[-k:]
        idx = idx[np.argsort(sims[idx])[::-1]]

        out: List[Dict[str, object]] = []
        for i in idx:
            out.append(
                {
                    "path": self.paths[int(i)],
                    "name": self.names[int(i)],
                    "similarity": float(max(0.0, min(1.0, float(sims[int(i)]))) * 100.0),
                }
            )
        return out


_DATASET_INDEX = DatasetVectorIndex()


@dataclass
class CandidateResult:
    candidate_id: str
    candidate_name: str
    similarity: float
    hash_similarity: float
    embedding_similarity: float


def _evict_cache_if_needed() -> None:
    if len(_SIG_CACHE) <= _CACHE_MAX_KEYS:
        return
    oldest_key = min(_SIG_CACHE, key=lambda k: _SIG_CACHE[k][0])
    _SIG_CACHE.pop(oldest_key, None)


def _cache_get(key: str) -> Optional[Dict[str, object]]:
    item = _SIG_CACHE.get(key)
    if not item:
        return None
    ts, val = item
    if (time.time() - ts) > _CACHE_TTL_SEC:
        _SIG_CACHE.pop(key, None)
        return None
    return val


def _cache_set(key: str, value: Dict[str, object]) -> None:
    _SIG_CACHE[key] = (time.time(), value)
    _evict_cache_if_needed()


def _is_video_file(path: str) -> bool:
    return Path(path).suffix.lower() in SUPPORTED_VIDEO_EXTS


def _is_video_url(url: str) -> bool:
    parsed = urlparse(url)
    return Path(parsed.path).suffix.lower() in SUPPORTED_VIDEO_EXTS


def _load_image_from_file(image_path: str) -> Image.Image:
    return Image.open(image_path).convert("RGB")


def _load_image_from_url(image_url: str, timeout: int = 12) -> Image.Image:
    resp = requests.get(image_url, timeout=timeout)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGB")


def _load_video_from_url_to_temp(video_url: str, timeout: int = 20) -> str:
    resp = requests.get(video_url, timeout=timeout)
    resp.raise_for_status()
    tmp_name = f"_tmp_video_{abs(hash(video_url))}.mp4"
    with open(tmp_name, "wb") as f:
        f.write(resp.content)
    return tmp_name


def _download_url_to_temp(url: str, suffix: Optional[str] = None, timeout: int = 20) -> str:
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix or ".bin") as tmp:
        tmp.write(resp.content)
        return tmp.name


def pil_to_cv2(image: Image.Image) -> np.ndarray:
    arr = np.array(image)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def generate_image_hash(image_path: str) -> str:
    """Generate perceptual hash (pHash) for an image file path."""
    img = _load_image_from_file(image_path)
    return str(imagehash.phash(img))


def generate_image_hash_from_pil(image: Image.Image) -> str:
    """Generate perceptual hash (pHash) from a PIL image."""
    return str(imagehash.phash(image))


def extract_video_frames(video_path: str, interval_sec: float = 1.0, max_frames: int = 120) -> List[Image.Image]:
    """Extract keyframes every N seconds from a video file.

    Args:
        video_path: Local path to video.
        interval_sec: Seconds between sampled frames.
        max_frames: Hard cap for lightweight processing.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_gap = max(int(fps * interval_sec), 1)
    frames: List[Image.Image] = []
    idx = 0

    while len(frames) < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % frame_gap == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(rgb))
        idx += 1

    cap.release()
    return frames


def generate_embedding(image: Image.Image) -> np.ndarray:
    """Generate a lightweight robust embedding vector from an image.

    Uses HSV color histogram + edge histogram for edit-resilient representation.
    """
    img = pil_to_cv2(image)

    resized = cv2.resize(img, (224, 224), interpolation=cv2.INTER_AREA)

    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    h_hist = cv2.calcHist([hsv], [0], None, [16], [0, 180]).flatten()
    s_hist = cv2.calcHist([hsv], [1], None, [16], [0, 256]).flatten()
    v_hist = cv2.calcHist([hsv], [2], None, [16], [0, 256]).flatten()

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    edge_hist = cv2.calcHist([edges], [0], None, [8], [0, 256]).flatten()

    vec = np.concatenate([h_hist, s_hist, v_hist, edge_hist]).astype(np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def compare_hashes(hash1: str, hash2: str) -> float:
    """Compare two perceptual hashes and return similarity percentage."""
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    dist = h1 - h2
    max_bits = len(hash1) * 4
    similarity = max(0.0, (1 - (dist / max_bits)) * 100)
    return float(similarity)


def compare_embeddings(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Compare two embeddings using cosine similarity and map to 0..100."""
    if vec1.ndim == 1:
        vec1 = vec1.reshape(1, -1)
    if vec2.ndim == 1:
        vec2 = vec2.reshape(1, -1)

    sim = float(cosine_similarity(vec1, vec2)[0][0])
    sim = max(0.0, min(1.0, sim))
    return sim * 100.0


def _fingerprint_image(image: Image.Image) -> Tuple[str, np.ndarray]:
    return generate_image_hash_from_pil(image), generate_embedding(image)


def _fingerprint_video(video_path: str) -> Tuple[str, np.ndarray]:
    frames = extract_video_frames(video_path, interval_sec=1.0)
    if not frames:
        raise ValueError("Unable to extract video frames")

    frame_hashes: List[str] = []
    frame_embeddings: List[np.ndarray] = []
    for frame in frames:
        f_hash, f_vec = _fingerprint_image(frame)
        frame_hashes.append(f_hash)
        frame_embeddings.append(f_vec)

    representative_hash = frame_hashes[len(frame_hashes) // 2]
    mean_embedding = np.mean(np.stack(frame_embeddings, axis=0), axis=0)
    norm = np.linalg.norm(mean_embedding)
    if norm > 0:
        mean_embedding = mean_embedding / norm
    return representative_hash, mean_embedding


def _video_frame_signatures(video_path: str, interval_sec: float = 1.0, max_frames: int = 24) -> List[Tuple[str, np.ndarray]]:
    frames = extract_video_frames(video_path, interval_sec=interval_sec, max_frames=max_frames)
    return [_fingerprint_image(frame) for frame in frames]


def _build_media_signature_from_file(path: str, declared_type: Optional[str] = None) -> Dict[str, object]:
    media_type = (declared_type or "").lower()
    is_video = media_type.startswith("video/") or _is_video_file(path)

    if is_video:
        frame_sigs = _video_frame_signatures(path)
        if not frame_sigs:
            raise ValueError("Unable to extract video signatures")
        hashes = [h for h, _ in frame_sigs]
        embs = [e for _, e in frame_sigs]
        rep_hash = hashes[len(hashes) // 2]
        rep_vec = np.mean(np.stack(embs, axis=0), axis=0)
        norm = np.linalg.norm(rep_vec)
        if norm > 0:
            rep_vec = rep_vec / norm
        return {
            "media_kind": "video",
            "hashes": hashes,
            "embeddings": embs,
            "representative_hash": rep_hash,
            "representative_embedding": rep_vec,
        }

    img = _load_image_from_file(path)
    h, e = _fingerprint_image(img)
    return {
        "media_kind": "image",
        "hashes": [h],
        "embeddings": [e],
        "representative_hash": h,
        "representative_embedding": e,
    }


def _build_media_signature_from_url(url: str, declared_type: Optional[str] = None) -> Dict[str, object]:
    cache_key = f"url::{declared_type or ''}::{url}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    media_type = (declared_type or "").lower()
    suffix = Path(urlparse(url).path).suffix.lower()
    is_video = media_type.startswith("video/") or _is_video_url(url)

    tmp_path = _download_url_to_temp(url, suffix=suffix if suffix else None)
    try:
        signature = _build_media_signature_from_file(tmp_path, declared_type="video/mp4" if is_video else "image/jpeg")
        _cache_set(cache_key, signature)
        return signature
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _score_signatures(sig_a: Dict[str, object], sig_b: Dict[str, object]) -> Tuple[float, float, float]:
    hashes_a: List[str] = sig_a["hashes"]
    hashes_b: List[str] = sig_b["hashes"]
    embs_a: List[np.ndarray] = sig_a["embeddings"]
    embs_b: List[np.ndarray] = sig_b["embeddings"]

    # For frame-based signatures, take best alignment to handle edits/crops/clips.
    best_hash = 0.0
    for ha in hashes_a:
        for hb in hashes_b:
            best_hash = max(best_hash, compare_hashes(ha, hb))

    best_emb = 0.0
    for ea in embs_a:
        for eb in embs_b:
            best_emb = max(best_emb, compare_embeddings(ea, eb))

    final_sim = (0.45 * best_hash) + (0.55 * best_emb)
    return best_hash, best_emb, float(final_sim)


def _fingerprint_input(input_file: str) -> Tuple[str, np.ndarray]:
    if _is_video_file(input_file):
        return _fingerprint_video(input_file)

    img = _load_image_from_file(input_file)
    return _fingerprint_image(img)


def _iter_dataset_files(dataset_folder: str) -> Iterable[str]:
    for root, _, files in os.walk(dataset_folder):
        for file_name in files:
            ext = Path(file_name).suffix.lower()
            if ext in SUPPORTED_IMAGE_EXTS or ext in SUPPORTED_VIDEO_EXTS:
                yield os.path.join(root, file_name)


def _fingerprint_candidate_file(path: str) -> Tuple[str, np.ndarray]:
    if _is_video_file(path):
        return _fingerprint_video(path)
    img = _load_image_from_file(path)
    return _fingerprint_image(img)


def analyze_media(
    input_file: str,
    dataset_folder: str,
    threshold: float = 80.0,
) -> Dict[str, object]:
    """Analyze input media against a local dataset folder.

    Returns status, similarity score, and best matched file.
    """
    in_hash, in_vec = _fingerprint_input(input_file)

    best: Optional[CandidateResult] = None

    for candidate_file in _iter_dataset_files(dataset_folder):
        try:
            c_hash, c_vec = _fingerprint_candidate_file(candidate_file)
            hash_sim = compare_hashes(in_hash, c_hash)
            emb_sim = compare_embeddings(in_vec, c_vec)
            final_sim = (0.45 * hash_sim) + (0.55 * emb_sim)

            current = CandidateResult(
                candidate_id=candidate_file,
                candidate_name=os.path.basename(candidate_file),
                similarity=float(final_sim),
                hash_similarity=float(hash_sim),
                embedding_similarity=float(emb_sim),
            )
            if best is None or current.similarity > best.similarity:
                best = current
        except Exception:
            continue

    if best is None:
        return {
            "status": "SAFE",
            "similarity": 0.0,
            "matched_file": None,
            "details": {"reason": "No comparable files found in dataset"},
        }

    status = "POTENTIAL MISUSE" if best.similarity >= threshold else "SAFE"
    return {
        "status": status,
        "similarity": round(best.similarity, 2),
        "matched_file": best.candidate_name,
        "matched_id": best.candidate_id,
        "details": {
            "hash_similarity": round(best.hash_similarity, 2),
            "embedding_similarity": round(best.embedding_similarity, 2),
        },
    }


def analyze_media_against_candidates(
    input_image: Image.Image,
    candidates: List[Dict[str, object]],
    threshold: float = 80.0,
) -> Dict[str, object]:
    """Analyze image input against in-memory candidates from API payload.

    Candidate format:
      {
        "id": "asset_1",
        "name": "file.jpg",
        "url": "https://...",
        "fingerprint": "abc..." (optional)
      }
    """
    in_hash, in_vec = _fingerprint_image(input_image)
    best: Optional[CandidateResult] = None

    for c in candidates:
        try:
            c_id = str(c.get("id") or "unknown")
            c_name = str(c.get("name") or c_id)
            c_url = c.get("url")
            c_fp = c.get("fingerprint")

            if c_url:
                c_img = _load_image_from_url(str(c_url))
                c_hash, c_vec = _fingerprint_image(c_img)
                hash_sim = compare_hashes(in_hash, c_hash)
                emb_sim = compare_embeddings(in_vec, c_vec)
                final_sim = (0.45 * hash_sim) + (0.55 * emb_sim)
            elif c_fp:
                c_hash = str(c_fp)
                hash_sim = compare_hashes(in_hash, c_hash)
                # If only hash is available, keep scoring hash-only to avoid false positives.
                emb_sim = hash_sim
                final_sim = hash_sim
            else:
                continue

            current = CandidateResult(
                candidate_id=c_id,
                candidate_name=c_name,
                similarity=float(final_sim),
                hash_similarity=float(hash_sim),
                embedding_similarity=float(emb_sim),
            )
            if best is None or current.similarity > best.similarity:
                best = current
        except Exception:
            continue

    if best is None:
        return {
            "status": "SAFE",
            "similarity": 0.0,
            "matched_file": None,
            "matched_id": None,
            "details": {"reason": "No valid candidates"},
            "fingerprint": in_hash,
        }

    status = "POTENTIAL MISUSE" if best.similarity >= threshold else "SAFE"
    return {
        "status": status,
        "similarity": round(best.similarity, 2),
        "matched_file": best.candidate_name,
        "matched_id": best.candidate_id,
        "details": {
            "hash_similarity": round(best.hash_similarity, 2),
            "embedding_similarity": round(best.embedding_similarity, 2),
        },
        "fingerprint": in_hash,
    }


def analyze_media_url_against_candidates(
    input_url: str,
    candidates: List[Dict[str, object]],
    threshold: float = 80.0,
    input_file_type: Optional[str] = None,
) -> Dict[str, object]:
    """Analyze image/video URL against candidate assets (image/video) with robust matching."""
    input_sig = _build_media_signature_from_url(input_url, declared_type=input_file_type)
    input_hash = str(input_sig["representative_hash"])

    best: Optional[CandidateResult] = None

    for c in candidates:
        try:
            c_id = str(c.get("id") or "unknown")
            c_name = str(c.get("name") or c_id)
            c_url = c.get("url")
            c_fp = c.get("fingerprint")
            c_type = c.get("file_type")

            if c_url:
                cand_sig = _build_media_signature_from_url(str(c_url), declared_type=str(c_type) if c_type else None)
                hash_sim, emb_sim, final_sim = _score_signatures(input_sig, cand_sig)
            elif c_fp:
                hash_sim = compare_hashes(input_hash, str(c_fp))
                emb_sim = hash_sim
                final_sim = hash_sim
            else:
                continue

            current = CandidateResult(
                candidate_id=c_id,
                candidate_name=c_name,
                similarity=float(final_sim),
                hash_similarity=float(hash_sim),
                embedding_similarity=float(emb_sim),
            )
            if best is None or current.similarity > best.similarity:
                best = current
        except Exception:
            continue

    if best is None:
        return {
            "status": "SAFE",
            "similarity": 0.0,
            "matched_file": None,
            "matched_id": None,
            "details": {"reason": "No valid candidates"},
            "fingerprint": input_hash,
        }

    status = "POTENTIAL MISUSE" if best.similarity >= threshold else "SAFE"
    return {
        "status": status,
        "similarity": round(best.similarity, 2),
        "matched_file": best.candidate_name,
        "matched_id": best.candidate_id,
        "details": {
            "hash_similarity": round(best.hash_similarity, 2),
            "embedding_similarity": round(best.embedding_similarity, 2),
        },
        "fingerprint": input_hash,
    }


def rebuild_dataset_index(dataset_folder: str) -> Dict[str, object]:
    return _DATASET_INDEX.build(dataset_folder)


def get_dataset_index_stats() -> Dict[str, object]:
    return _DATASET_INDEX.stats()


def _ensure_index(dataset_folder: str) -> None:
    stats = _DATASET_INDEX.stats()
    if (not stats["ready"]) or stats.get("dataset_folder") != dataset_folder:
        _DATASET_INDEX.build(dataset_folder)


def analyze_media_with_index(
    input_file: str,
    dataset_folder: str,
    threshold: float = 80.0,
    top_k: int = 25,
) -> Dict[str, object]:
    _ensure_index(dataset_folder)
    query_sig = _build_media_signature_from_file(input_file)

    nearest = _DATASET_INDEX.search(query_sig["representative_embedding"], top_k=top_k)
    best: Optional[CandidateResult] = None

    for item in nearest:
        try:
            path = item["path"]
            cand_sig = _DATASET_INDEX.signatures.get(path)
            if not cand_sig:
                continue
            hash_sim, emb_sim, final_sim = _score_signatures(query_sig, cand_sig)

            current = CandidateResult(
                candidate_id=path,
                candidate_name=item["name"],
                similarity=float(final_sim),
                hash_similarity=float(hash_sim),
                embedding_similarity=float(emb_sim),
            )
            if best is None or current.similarity > best.similarity:
                best = current
        except Exception:
            continue

    if best is None:
        return {
            "status": "SAFE",
            "similarity": 0.0,
            "matched_file": None,
            "matched_id": None,
            "details": {"reason": "No indexed matches"},
        }

    status = "POTENTIAL MISUSE" if best.similarity >= threshold else "SAFE"
    return {
        "status": status,
        "similarity": round(best.similarity, 2),
        "matched_file": best.candidate_name,
        "matched_id": best.candidate_id,
        "details": {
            "hash_similarity": round(best.hash_similarity, 2),
            "embedding_similarity": round(best.embedding_similarity, 2),
            "indexed_top_k": top_k,
        },
    }


def analyze_url_with_index(
    input_url: str,
    dataset_folder: str,
    threshold: float = 80.0,
    top_k: int = 25,
    input_file_type: Optional[str] = None,
) -> Dict[str, object]:
    _ensure_index(dataset_folder)
    query_sig = _build_media_signature_from_url(input_url, declared_type=input_file_type)
    input_hash = str(query_sig["representative_hash"])

    nearest = _DATASET_INDEX.search(query_sig["representative_embedding"], top_k=top_k)
    best: Optional[CandidateResult] = None

    for item in nearest:
        try:
            path = item["path"]
            cand_sig = _DATASET_INDEX.signatures.get(path)
            if not cand_sig:
                continue

            hash_sim, emb_sim, final_sim = _score_signatures(query_sig, cand_sig)
            current = CandidateResult(
                candidate_id=path,
                candidate_name=item["name"],
                similarity=float(final_sim),
                hash_similarity=float(hash_sim),
                embedding_similarity=float(emb_sim),
            )
            if best is None or current.similarity > best.similarity:
                best = current
        except Exception:
            continue

    if best is None:
        return {
            "status": "SAFE",
            "similarity": 0.0,
            "matched_file": None,
            "matched_id": None,
            "details": {"reason": "No indexed matches"},
            "fingerprint": input_hash,
        }

    status = "POTENTIAL MISUSE" if best.similarity >= threshold else "SAFE"
    return {
        "status": status,
        "similarity": round(best.similarity, 2),
        "matched_file": best.candidate_name,
        "matched_id": best.candidate_id,
        "details": {
            "hash_similarity": round(best.hash_similarity, 2),
            "embedding_similarity": round(best.embedding_similarity, 2),
            "indexed_top_k": top_k,
        },
        "fingerprint": input_hash,
    }
