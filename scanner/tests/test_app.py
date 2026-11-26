from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

import app as scanner_app


class FakeReader:
    def __init__(self, response: bytes) -> None:
        self.response = response

    async def readuntil(self, separator: bytes) -> bytes:
        assert separator == b"\0"
        return self.response


class FakeWriter:
    def __init__(self) -> None:
        self.data = bytearray()
        self.closed = False

    def write(self, value: bytes) -> None:
        self.data.extend(value)

    async def drain(self) -> None:
        return None

    def close(self) -> None:
        self.closed = True

    async def wait_closed(self) -> None:
        return None


def configure(monkeypatch, response: bytes = b"stream: OK\0"):
    monkeypatch.setenv("SCANNER_API_KEY", "test-api-key-with-at-least-32-bytes")
    monkeypatch.setenv("CLAMAV_HOST", "clamav.internal")
    monkeypatch.setenv("CLAMAV_PORT", "3310")
    monkeypatch.setenv("CLAMAV_TIMEOUT_SECONDS", "2")
    writer = FakeWriter()

    async def fake_open_connection(host: str, port: int):
        assert host == "clamav.internal"
        assert port == 3310
        return FakeReader(response), writer

    monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
    return writer


def test_scan_requires_bearer_auth(monkeypatch):
    configure(monkeypatch)
    with TestClient(scanner_app.app) as client:
        response = client.post("/v1/scan", content=b"test")
    assert response.status_code == 401


def test_clean_file_is_returned_only_after_clamd_ok(monkeypatch):
    writer = configure(monkeypatch)
    with TestClient(scanner_app.app) as client:
        response = client.post(
            "/v1/scan",
            content=b"safe file content",
            headers={"Authorization": "Bearer test-api-key-with-at-least-32-bytes"},
        )
    assert response.status_code == 200
    assert response.json() == {"status": "clean"}
    assert writer.data.startswith(b"zINSTREAM\0")
    assert b"safe file content" in writer.data
    assert writer.data.endswith(b"\0\0\0\0")


def test_infected_file_is_rejected_with_signature(monkeypatch):
    configure(monkeypatch, b"stream: Win.Test.EICAR_HDB-1 FOUND\0")
    with TestClient(scanner_app.app) as client:
        response = client.post(
            "/v1/scan",
            content=b"malware",
            headers={"Authorization": "Bearer test-api-key-with-at-least-32-bytes"},
        )
    assert response.status_code == 422
    assert response.json() == {
        "status": "infected",
        "signature": "Win.Test.EICAR_HDB-1",
    }


def test_oversized_body_is_rejected_before_clamd_connection(monkeypatch):
    monkeypatch.setenv("SCANNER_API_KEY", "test-api-key-with-at-least-32-bytes")
    monkeypatch.setenv("CLAMAV_HOST", "clamav.internal")

    async def should_not_connect(*args, **kwargs):
        raise AssertionError("ClamAV must not receive an oversized file.")

    monkeypatch.setattr(asyncio, "open_connection", should_not_connect)
    with TestClient(scanner_app.app) as client:
        response = client.post(
            "/v1/scan",
            content=b"x" * (4 * 1024 * 1024 + 1),
            headers={"Authorization": "Bearer test-api-key-with-at-least-32-bytes"},
        )
    assert response.status_code == 413


def test_unknown_clamd_verdict_fails_closed(monkeypatch):
    configure(monkeypatch, b"stream: ERROR\0")
    with TestClient(scanner_app.app) as client:
        response = client.post(
            "/v1/scan",
            content=b"file",
            headers={"Authorization": "Bearer test-api-key-with-at-least-32-bytes"},
        )
    assert response.status_code == 503


def test_missing_api_key_fails_startup(monkeypatch):
    monkeypatch.delenv("SCANNER_API_KEY", raising=False)
    monkeypatch.setenv("CLAMAV_HOST", "clamav.internal")
    try:
        with TestClient(scanner_app.app):
            raise AssertionError("Application unexpectedly started without an API key.")
    except RuntimeError as error:
        assert "SCANNER_API_KEY" in str(error)


def test_health_check_uses_clamd_ping(monkeypatch):
    writer = configure(monkeypatch, b"PONG\0")
    with TestClient(scanner_app.app) as client:
        response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert writer.data == b"zPING\0"
