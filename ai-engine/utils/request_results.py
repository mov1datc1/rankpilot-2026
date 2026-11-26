"""Finished answers kept briefly for the caller that asked for them.

v1.0.120: a real job stopped as "outcome unknown" although the engine had
answered 200 thirty seconds earlier: the application lost the connection while
reading the answer, and nothing could establish what the paid call produced.
The engine now keeps each finished answer under the id its caller sent, so the
caller reads it again instead of stopping the case or buying the call twice.

Kept in memory only, behind the service token, for a short time and a small
number of answers. A restart forgets them: the caller then sees "unknown", as
before. Nothing here starts, repeats or changes a provider call.
"""
import re
import threading
import time

TTL_SECONDS = 1800
MAX_RESULTS = 24
MAX_BODY_BYTES = 8_000_000
_ID = re.compile(r'[A-Za-z0-9-]{16,64}')
_lock = threading.Lock()
_running: dict = {}
_finished: dict = {}


def valid(request_id) -> bool:
    return isinstance(request_id, str) and bool(_ID.fullmatch(request_id))


def _expire(now: float) -> None:
    for store in (_running, _finished):
        for key in [key for key, value in store.items() if now - value[0] > TTL_SECONDS]:
            del store[key]
    while len(_finished) > MAX_RESULTS:
        del _finished[min(_finished, key=lambda key: _finished[key][0])]


def begin(request_id: str) -> None:
    with _lock:
        now = time.time()
        _expire(now)
        _running[request_id] = (now,)


def finish(request_id: str, status: int, body: bytes, media_type: str) -> None:
    with _lock:
        _running.pop(request_id, None)
        if len(body) <= MAX_BODY_BYTES:
            _finished[request_id] = (time.time(), int(status), bytes(body), media_type or 'application/json')
        _expire(time.time())


def abandon(request_id: str) -> None:
    with _lock:
        _running.pop(request_id, None)


def lookup(request_id: str):
    """('finished', status, body, media_type), ('running',) or None."""
    with _lock:
        _expire(time.time())
        saved = _finished.get(request_id)
        if saved:
            return ('finished', saved[1], saved[2], saved[3])
        return ('running',) if request_id in _running else None


async def body_of(response) -> bytes:
    """The whole body of a response the middleware is about to send."""
    iterator = getattr(response, 'body_iterator', None)
    if iterator is None:
        return bytes(getattr(response, 'body', b'') or b'')
    chunks = []
    async for chunk in iterator:
        chunks.append(chunk if isinstance(chunk, bytes) else str(chunk).encode('utf-8'))
    return b''.join(chunks)


def clear() -> None:
    with _lock:
        _running.clear()
        _finished.clear()
