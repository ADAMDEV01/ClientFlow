from __future__ import annotations

import asyncio
import hmac
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

MAX_SCAN_BYTES = 4 * 1024 * 1024
MAX_CLAMD_RESPONSE_BYTES = 4096
SCAN_CONCURRENCY = 4
_scan_slots = asyncio.Semaphore(SCAN_CONCURRENCY)


class ScannerUnavailable(Exception):
    pass


def _scanner_config() -> tuple[str, int, float, int]:
    host = os.environ.get("CLAMAV_HOST", "").strip()
    if not host:
        raise ScannerUnavailable("Scanner host is not configured.")

    try:
        port = int(os.environ.get("CLAMAV_PORT", "3310"))
        timeout = float(os.environ.get("CLAMAV_TIMEOUT_SECONDS", "20"))
        max_bytes = int(os.environ.get("MAX_SCAN_BYTES", str(MAX_SCAN_BYTES)))
    except ValueError as error:
        raise ScannerUnavailable("Scanner configuration is invalid.") from error

    if not 1 <= port <= 65535 or not 1 <= timeout <= 60:
        raise ScannerUnavailable("Scanner configuration is outside the allowed range.")
    if not 1 <= max_bytes <= MAX_SCAN_BYTES:
        raise ScannerUnavailable("MAX_SCAN_BYTES must be between 1 and 4194304.")
    return host, port, timeout, max_bytes


def _authorized(request: Request) -> bool:
    expected = os.environ.get("SCANNER_API_KEY", "")
    supplied = request.headers.get("authorization", "")
    if len(expected.encode("utf-8")) < 32 or not supplied.startswith("Bearer "):
        return False
    token = supplied[7:]
    return bool(token) and hmac.compare_digest(
        token.encode("utf-8"),
        expected.encode("utf-8"),
    )


async def _clamd_command(command: bytes, *, timeout: float) -> bytes:
    host, port, _, _ = _scanner_config()
    writer = None
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.write(command)
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        response = await asyncio.wait_for(
            reader.readuntil(b"\0"),
            timeout=timeout,
        )
        if len(response) > MAX_CLAMD_RESPONSE_BYTES:
            raise ScannerUnavailable("ClamAV returned an oversized response.")
        return response[:-1].decode("utf-8", errors="replace").strip().encode("utf-8")
    except (OSError, asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError) as error:
        raise ScannerUnavailable("ClamAV is unavailable or did not respond in time.") from error
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except OSError:
                pass


async def _scan_with_clamd(payload: bytes, *, timeout: float) -> tuple[bool, str | None]:
    host, port, _, _ = _scanner_config()
    writer = None
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.write(b"zINSTREAM\0")
        for offset in range(0, len(payload), 64 * 1024):
            chunk = payload[offset : offset + 64 * 1024]
            writer.write(len(chunk).to_bytes(4, "big"))
            writer.write(chunk)
        writer.write(b"\0\0\0\0")
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        response = await asyncio.wait_for(
            reader.readuntil(b"\0"),
            timeout=timeout,
        )
        if len(response) > MAX_CLAMD_RESPONSE_BYTES:
            raise ScannerUnavailable("ClamAV returned an oversized response.")
        line = response[:-1].decode("utf-8", errors="replace").strip()
    except (OSError, asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError) as error:
        raise ScannerUnavailable("ClamAV is unavailable or did not respond in time.") from error
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except OSError:
                pass

    if line.endswith(": OK"):
        return True, None
    if line.endswith(" FOUND"):
        signature = line.rsplit(":", 1)[-1].removesuffix(" FOUND").strip()
        return False, (signature or "Unknown malware")[:200]
    raise ScannerUnavailable("ClamAV returned an unexpected verdict.")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    key = os.environ.get("SCANNER_API_KEY", "")
    if len(key.encode("utf-8")) < 32:
        raise RuntimeError("SCANNER_API_KEY must contain at least 32 bytes.")
    _scanner_config()
    yield


app = FastAPI(
    title="Private ClamAV Gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    try:
        _, _, timeout, _ = _scanner_config()
        response = await _clamd_command(b"zPING\0", timeout=min(timeout, 3))
    except ScannerUnavailable as error:
        raise HTTPException(status_code=503, detail="Scanner unavailable.") from error
    if response != b"PONG":
        raise HTTPException(status_code=503, detail="Scanner unavailable.")
    return {"status": "ok"}


@app.post("/v1/scan")
async def scan(request: Request) -> JSONResponse:
    if not _authorized(request):
        raise HTTPException(status_code=401, detail="Invalid scanner credentials.")

    content_encoding = request.headers.get("content-encoding", "identity").lower()
    if content_encoding not in {"", "identity"}:
        raise HTTPException(status_code=415, detail="Content encoding is not supported.")

    try:
        _, _, timeout, max_bytes = _scanner_config()
    except ScannerUnavailable as error:
        raise HTTPException(status_code=503, detail="Scanner unavailable.") from error

    declared_length = request.headers.get("content-length")
    if declared_length:
        try:
            if int(declared_length) > max_bytes:
                raise HTTPException(status_code=413, detail="File exceeds the scan size limit.")
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Invalid content length.") from error

    payload = bytearray()
    async for chunk in request.stream():
        payload.extend(chunk)
        if len(payload) > max_bytes:
            raise HTTPException(status_code=413, detail="File exceeds the scan size limit.")
    if not payload:
        raise HTTPException(status_code=400, detail="Empty files cannot be scanned.")

    try:
        async with _scan_slots:
            clean, signature = await _scan_with_clamd(bytes(payload), timeout=timeout)
    except ScannerUnavailable as error:
        raise HTTPException(status_code=503, detail="Scanner unavailable.") from error

    if not clean:
        return JSONResponse(
            status_code=422,
            content={"status": "infected", "signature": signature},
        )
    return JSONResponse(status_code=200, content={"status": "clean"})
