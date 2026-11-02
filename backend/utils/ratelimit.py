"""محدّد بسيط لعدد المحاولات في الذاكرة - لمنع تخمين البيانات"""
import threading
import time
from collections import defaultdict, deque

from config import settings


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """
        تُرجع (مسموح، عدد الثواني المتبقية للحظر).
        تُحتسب المحاولة عند السماح بها.
        """
        now = time.time()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()

            if len(hits) >= self.max_attempts:
                retry_after = int(self.window - (now - hits[0])) + 1
                return False, retry_after

            hits.append(now)

            # تنظيف دوري بسيط لتفادي نمو الذاكرة
            if len(self._hits) > 5000:
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
                    self._hits.pop(k, None)

            return True, 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


attendance_limiter = RateLimiter(
    max_attempts=settings.attendance_rate_limit,
    window_seconds=settings.attendance_rate_window,
)
login_limiter = RateLimiter(
    max_attempts=settings.login_rate_limit,
    window_seconds=settings.login_rate_window,
)

# الاستعلام عن الحالة يحدث عند كل فتح للصفحة - حد أعلى من حد التأكيد
status_limiter = RateLimiter(
    max_attempts=settings.attendance_rate_limit * 3,
    window_seconds=settings.attendance_rate_window,
)
