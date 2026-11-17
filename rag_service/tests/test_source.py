import httpx
import pytest

from app.source import SourceError, fetch_pdf, host_allowed

ALLOWED = ["blob.vercel-storage.com"]


@pytest.mark.parametrize(
    "url,ok",
    [
        ("https://abc.private.blob.vercel-storage.com/pdfs/u1/a.pdf", True),
        ("https://blob.vercel-storage.com/x", True),
        ("http://abc.private.blob.vercel-storage.com/a.pdf", False),  # not https
        ("https://evil.com/blob.vercel-storage.com/a.pdf", False),  # host is evil.com
        ("https://blob.vercel-storage.com.evil.com/a.pdf", False),  # suffix trick
        ("https://evilblob.vercel-storage.com/a.pdf", False),  # not a subdomain boundary
        ("https://169.254.169.254/latest/meta-data", False),  # cloud metadata endpoint
        ("https://user@abc.blob.vercel-storage.com@evil.com/a", False),
        ("file:///etc/passwd", False),
    ],
)
def test_host_allowlist(url, ok):
    assert host_allowed(url, ALLOWED) is ok


def client_returning(status=200, body=b"%PDF-1.4 data", headers=None):
    def handler(request):
        return httpx.Response(status, content=body, headers=headers or {})

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_downloads_allowed_url():
    data = fetch_pdf("https://a.private.blob.vercel-storage.com/x.pdf", ALLOWED, 1000, client_returning())
    assert data == b"%PDF-1.4 data"


def test_rejects_disallowed_host_without_requesting():
    def handler(request):
        raise AssertionError("must not be requested")

    with pytest.raises(SourceError, match="not allowed"):
        fetch_pdf("https://evil.com/x.pdf", ALLOWED, 1000, httpx.Client(transport=httpx.MockTransport(handler)))


def test_enforces_size_limit_even_without_content_length():
    with pytest.raises(SourceError, match="larger"):
        fetch_pdf("https://a.blob.vercel-storage.com/x", ALLOWED, 10, client_returning(body=b"x" * 50))
    with pytest.raises(SourceError, match="larger"):
        fetch_pdf(
            "https://a.blob.vercel-storage.com/x", ALLOWED, 10,
            client_returning(body=b"x", headers={"content-length": "999"}),
        )  # fmt: skip


def test_http_errors_and_redirects_are_failures():
    with pytest.raises(SourceError, match="HTTP 403"):
        fetch_pdf("https://a.blob.vercel-storage.com/x", ALLOWED, 1000, client_returning(status=403))
    with pytest.raises(SourceError, match="HTTP 302"):
        fetch_pdf(
            "https://a.blob.vercel-storage.com/x", ALLOWED, 1000,
            client_returning(status=302, headers={"location": "https://169.254.169.254/"}),
        )  # fmt: skip
