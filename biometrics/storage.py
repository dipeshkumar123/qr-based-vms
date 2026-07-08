import os
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple
import logging
from collections import OrderedDict
import threading
from io import BytesIO

import numpy as np
from PIL import Image

logger = logging.getLogger("biometric-storage")

class StorageProvider(ABC):
    @abstractmethod
    def save_face_encoding(self, visitor_id: int, encoding: np.ndarray) -> bool:
        pass

    @abstractmethod
    def load_face_encoding(self, visitor_id: int) -> Optional[np.ndarray]:
        pass

    @abstractmethod
    def save_photo(self, visitor_id: int, image: Image.Image, suffix: str = "capture") -> bool:
        pass

    @abstractmethod
    def count_visitor_photos(self, visitor_id: int) -> int:
        pass

    @abstractmethod
    def has_encoding(self, visitor_id: int) -> bool:
        pass

    @abstractmethod
    def get_encoding_time(self, visitor_id: int) -> Optional[str]:
        pass

    @abstractmethod
    def delete_visitor_data(self, visitor_id: int) -> int:
        pass

    @abstractmethod
    def get_stats(self) -> dict:
        pass


class FileSystemStorage(StorageProvider):
    def __init__(self, storage_dir: str, cache_max_items: int = 512):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.face_encoding_dir = self.storage_dir / "encodings"
        self.face_encoding_dir.mkdir(exist_ok=True)
        
        self.photo_dir = self.storage_dir / "photos"
        self.photo_dir.mkdir(exist_ok=True)
        
        self._encoding_cache = OrderedDict()
        self._encoding_cache_lock = threading.Lock()
        self.cache_max_items = cache_max_items
        
    def save_face_encoding(self, visitor_id: int, encoding: np.ndarray) -> bool:
        try:
            encoding_path = self.face_encoding_dir / f"visitor_{visitor_id}_encoding.npy"
            np.save(encoding_path, encoding)
            with self._encoding_cache_lock:
                self._encoding_cache[visitor_id] = encoding
                self._encoding_cache.move_to_end(visitor_id)
                while len(self._encoding_cache) > self.cache_max_items:
                    self._encoding_cache.popitem(last=False)
            return True
        except Exception as e:
            logger.error("Error saving encoding for visitor %d: %s", visitor_id, e)
            return False

    def load_face_encoding(self, visitor_id: int) -> Optional[np.ndarray]:
        try:
            with self._encoding_cache_lock:
                cached = self._encoding_cache.get(visitor_id)
                if cached is not None:
                    self._encoding_cache.move_to_end(visitor_id)
                    return cached

            encoding_path = self.face_encoding_dir / f"visitor_{visitor_id}_encoding.npy"
            if encoding_path.exists():
                encoding = np.load(encoding_path, allow_pickle=False)
                with self._encoding_cache_lock:
                    self._encoding_cache[visitor_id] = encoding
                    self._encoding_cache.move_to_end(visitor_id)
                    while len(self._encoding_cache) > self.cache_max_items:
                        self._encoding_cache.popitem(last=False)
                return encoding
            return None
        except Exception as e:
            logger.error("Error loading encoding for visitor %d: %s", visitor_id, e)
            return None

    def save_photo(self, visitor_id: int, image: Image.Image, suffix: str = "capture") -> bool:
        try:
            ts = int(time.time())
            photo_path = self.photo_dir / f"visitor_{visitor_id}_{suffix}_{ts}.jpg"
            image.save(photo_path, "JPEG", quality=85)
            return True
        except Exception as e:
            logger.error("Error saving photo for visitor %d: %s", visitor_id, e)
            return False

    def count_visitor_photos(self, visitor_id: int) -> int:
        return len(list(self.photo_dir.glob(f"visitor_{visitor_id}_*")))

    def has_encoding(self, visitor_id: int) -> bool:
        encoding_path = self.face_encoding_dir / f"visitor_{visitor_id}_encoding.npy"
        return encoding_path.exists()

    def get_encoding_time(self, visitor_id: int) -> Optional[str]:
        encoding_path = self.face_encoding_dir / f"visitor_{visitor_id}_encoding.npy"
        if encoding_path.exists():
            try:
                stat = encoding_path.stat()
                return datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
            except OSError:
                pass
        return None

    def delete_visitor_data(self, visitor_id: int) -> int:
        deleted_files = 0
        try:
            encoding_path = self.face_encoding_dir / f"visitor_{visitor_id}_encoding.npy"
            if encoding_path.exists():
                encoding_path.unlink()
                deleted_files += 1

            with self._encoding_cache_lock:
                self._encoding_cache.pop(visitor_id, None)

            for photo in self.photo_dir.glob(f"visitor_{visitor_id}_*"):
                photo.unlink()
                deleted_files += 1

            return deleted_files
        except Exception as e:
            logger.error("Error deleting data for visitor %d: %s", visitor_id, e)
            raise

    def get_stats(self) -> dict:
        encoding_files = list(self.face_encoding_dir.glob("*.npy"))
        photo_files = list(self.photo_dir.glob("*.jpg"))

        encoding_bytes = sum(f.stat().st_size for f in encoding_files)
        photo_bytes = sum(f.stat().st_size for f in photo_files)

        return {
            "encodings_stored": len(encoding_files),
            "photos_stored": len(photo_files),
            "encoding_storage_mb": round(encoding_bytes / (1024 * 1024), 2),
            "photo_storage_mb": round(photo_bytes / (1024 * 1024), 2),
            "total_storage_mb": round((encoding_bytes + photo_bytes) / (1024 * 1024), 2),
            "storage_type": "filesystem",
            "storage_dir": str(self.storage_dir)
        }

class InMemoryStorage(StorageProvider):
    def __init__(self):
        self._encodings = {}  # visitor_id -> (encoding, timestamp)
        self._photos = {}     # visitor_id -> list of (photo_bytes, suffix, timestamp)
        self._lock = threading.Lock()

    def save_face_encoding(self, visitor_id: int, encoding: np.ndarray) -> bool:
        with self._lock:
            self._encodings[visitor_id] = (encoding, time.time())
        return True

    def load_face_encoding(self, visitor_id: int) -> Optional[np.ndarray]:
        with self._lock:
            data = self._encodings.get(visitor_id)
            if data:
                return data[0]
            return None

    def save_photo(self, visitor_id: int, image: Image.Image, suffix: str = "capture") -> bool:
        try:
            # Save to bytes in memory
            buf = BytesIO()
            image.save(buf, format="JPEG", quality=85)
            photo_bytes = buf.getvalue()
            
            with self._lock:
                if visitor_id not in self._photos:
                    self._photos[visitor_id] = []
                self._photos[visitor_id].append((photo_bytes, suffix, time.time()))
            return True
        except Exception as e:
            logger.error("Error saving photo to memory for visitor %d: %s", visitor_id, e)
            return False

    def count_visitor_photos(self, visitor_id: int) -> int:
        with self._lock:
            return len(self._photos.get(visitor_id, []))

    def has_encoding(self, visitor_id: int) -> bool:
        with self._lock:
            return visitor_id in self._encodings

    def get_encoding_time(self, visitor_id: int) -> Optional[str]:
        with self._lock:
            data = self._encodings.get(visitor_id)
            if data:
                return datetime.fromtimestamp(data[1], tz=timezone.utc).isoformat()
            return None

    def delete_visitor_data(self, visitor_id: int) -> int:
        deleted = 0
        with self._lock:
            if visitor_id in self._encodings:
                del self._encodings[visitor_id]
                deleted += 1
            if visitor_id in self._photos:
                deleted += len(self._photos[visitor_id])
                del self._photos[visitor_id]
        return deleted

    def get_stats(self) -> dict:
        with self._lock:
            encodings_stored = len(self._encodings)
            photos_stored = sum(len(p) for p in self._photos.values())
            
            # Estimate size
            encoding_bytes = sum(e[0].nbytes for e in self._encodings.values())
            photo_bytes = sum(len(photo[0]) for plist in self._photos.values() for photo in plist)

        return {
            "encodings_stored": encodings_stored,
            "photos_stored": photos_stored,
            "encoding_storage_mb": round(encoding_bytes / (1024 * 1024), 2),
            "photo_storage_mb": round(photo_bytes / (1024 * 1024), 2),
            "total_storage_mb": round((encoding_bytes + photo_bytes) / (1024 * 1024), 2),
            "storage_type": "memory",
            "storage_dir": "in-memory"
        }
