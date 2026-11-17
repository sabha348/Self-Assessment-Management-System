"""Download a PDF from a URL the backend hands us (a short-lived signed link to
private Vercel Blob storage), so large PDFs never pass through a request body
(serverless functions cap request bodies at 4.5 MB)."""

from urllib.parse import urlsplit

import httpx


class SourceError(ValueError):
    """The URL is not allowed, or the download failed or was too large."""


def host_allowed(url: str, allowed_suffixes: list[str]) -> bool:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host:
        return False
    return any(host == s.lstrip(".") or host.endswith("." + s.lstrip(".")) for s in allowed_suffixes if s)


def fetch_pdf(url: str, allowed_suffixes: list[str], max_bytes: int, client: httpx.Client | None = None) -> bytes:
    # Only fetch from the storage host we expect: this endpoint must not become a way
    # to make the service request arbitrary internal or external URLs (SSRF).
    if not host_allowed(url, allowed_suffixes):
        raise SourceError("source URL host is not allowed")
    own = client is None
    client = client or httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0), follow_redirects=False)
    try:
        with client.stream("GET", url) as resp:
            if resp.status_code != 200:
                raise SourceError(f"download failed with HTTP {resp.status_code}")
            declared = int(resp.headers.get("content-length") or 0)
            if declared > max_bytes:
                raise SourceError("PDF is larger than the upload limit")
            chunks, size = [], 0
            for chunk in resp.iter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    raise SourceError("PDF is larger than the upload limit")
                chunks.append(chunk)
            return b"".join(chunks)
    except httpx.HTTPError as e:
        raise SourceError(f"download failed: {type(e).__name__}") from e
    finally:
        if own:
            client.close()
