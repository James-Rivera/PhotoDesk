from __future__ import annotations

import time
from collections import defaultdict, deque

import httpx
from fastapi import HTTPException, status

from .config import Settings


class StaffAuthorizer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def require_active_staff(self, authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication is required")
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication is required")

        headers = {
            "apikey": self.settings.supabase_publishable_key,
            "Authorization": f"Bearer {token}",
        }
        timeout = httpx.Timeout(10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                user_response = await client.get(
                    f"{self.settings.supabase_url}/auth/v1/user",
                    headers=headers,
                )
                if user_response.status_code != 200:
                    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "The staff session is invalid")
                user_id = user_response.json().get("id")
                if not user_id:
                    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "The staff session is invalid")

                active_response = await client.post(
                    f"{self.settings.supabase_url}/rest/v1/rpc/is_active_staff",
                    headers={**headers, "Content-Type": "application/json"},
                    json={},
                )
                if active_response.status_code != 200 or active_response.json() is not True:
                    raise HTTPException(status.HTTP_403_FORBIDDEN, "An active staff profile is required")
                return str(user_id)
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Staff authentication could not be verified",
            ) from error


class UserRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def consume(self, user_id: str) -> None:
        now = time.monotonic()
        events = self._events[user_id]
        threshold = now - self.window_seconds
        while events and events[0] <= threshold:
            events.popleft()
        if len(events) >= self.limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many background-removal requests")
        events.append(now)
