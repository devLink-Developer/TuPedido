from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class StoreStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "suspended"]
