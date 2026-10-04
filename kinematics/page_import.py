import http.client
import ipaddress
import json
import socket
import ssl
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit


MAX_PAGE_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 3
MAX_URL_LENGTH = 2048
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class RobotPageImportError(ValueError):
    pass


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, hostname: str, address: str) -> None:
        super().__init__(address, port=443, timeout=5, context=ssl.create_default_context())
        self.hostname = hostname
        self.address = address

    def connect(self) -> None:
        raw_socket = socket.create_connection((self.address, 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.hostname)
        except Exception:
            raw_socket.close()
            raise


def _validate_page_url(url: str) -> tuple[Any, str, str]:
    if len(url) > MAX_URL_LENGTH:
        raise RobotPageImportError("The product page URL is too long.")
    try:
        parsed = urlsplit(url.strip())
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        raise RobotPageImportError("Enter a valid HTTPS product page URL.") from None
    if (
        parsed.scheme.lower() != "https"
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
    ):
        raise RobotPageImportError("Only public HTTPS product page links on the standard port are supported.")

    try:
        literal_address = ipaddress.ip_address(hostname)
    except ValueError:
        try:
            addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        except OSError:
            raise RobotPageImportError("The product page host could not be reached.") from None
        unique_addresses = list(dict.fromkeys(record[4][0] for record in addresses))
        if not unique_addresses or any(not ipaddress.ip_address(address).is_global for address in unique_addresses):
            raise RobotPageImportError("The product page must resolve only to public internet addresses.")
        address = unique_addresses[0]
    else:
        if not literal_address.is_global:
            raise RobotPageImportError("The product page must use a public internet address.")
        address = str(literal_address)

    return parsed, hostname, address


def _read_product_page(url: str) -> tuple[str, str]:
    current_url = url
    for redirect_count in range(MAX_REDIRECTS + 1):
        parsed, hostname, address = _validate_page_url(current_url)
        path = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
        host_header = f"[{hostname}]" if ":" in hostname else hostname
        connection = _PinnedHTTPSConnection(hostname, address)
        try:
            connection.request(
                "GET",
                path,
                headers={
                    "Host": host_header,
                    "Accept": "text/html,application/xhtml+xml",
                    "User-Agent": "FrameByFrameRobotImporter/1.0",
                    "Connection": "close",
                },
            )
            response = connection.getresponse()
            if response.status in _REDIRECT_STATUSES:
                location = response.getheader("Location")
                if not location or redirect_count == MAX_REDIRECTS:
                    raise RobotPageImportError("The product page redirected too many times.")
                current_url = urljoin(current_url, location)
                continue
            if response.status != 200:
                raise RobotPageImportError(f"The product page returned HTTP {response.status}.")
            content_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type not in {"text/html", "application/xhtml+xml"}:
                raise RobotPageImportError("That link did not return a web page.")
            content_length = response.getheader("Content-Length")
            if content_length:
                try:
                    if int(content_length) > MAX_PAGE_BYTES:
                        raise RobotPageImportError("The product page is too large to inspect.")
                except ValueError:
                    raise RobotPageImportError("The product page returned an invalid content length.") from None

            body = bytearray()
            while chunk := response.read(64 * 1024):
                body.extend(chunk)
                if len(body) > MAX_PAGE_BYTES:
                    raise RobotPageImportError("The product page is too large to inspect.")
            charset = response.headers.get_content_charset() or "utf-8"
            try:
                return body.decode(charset, errors="replace"), current_url
            except LookupError:
                return body.decode("utf-8", errors="replace"), current_url
        except (OSError, ssl.SSLError, http.client.HTTPException, TimeoutError):
            raise RobotPageImportError("Could not safely read that product page.") from None
        finally:
            connection.close()
    raise RobotPageImportError("The product page redirected too many times.")


class _RobotPageParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title_parts: list[str] = []
        self.in_title = False
        self.page_title = ""
        self.candidates: list[tuple[int, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            key = values.get("property", "").lower() or values.get("name", "").lower()
            content = values.get("content", "").strip()
            if key == "og:title" and content and not self.page_title:
                self.page_title = content
            priority = {"og:image": 0, "og:image:url": 1, "twitter:image": 2, "twitter:image:src": 3}.get(key)
            if priority is not None and content:
                self._add_image(content, priority)
        elif tag == "link" and "image_src" in values.get("rel", "").lower().split():
            self._add_image(values.get("href", ""), 4)
        elif tag == "img":
            source = values.get("src") or values.get("data-src") or values.get("data-lazy-src")
            if source:
                labels = " ".join(
                    (values.get("alt", ""), values.get("class", ""), values.get("id", ""), values.get("data-testid", ""))
                ).lower()
                priority = 5 if any(word in labels for word in ("robot", "product", "hero", "main", "model")) else 10
                self._add_image(source, priority)
            srcset = values.get("srcset", "").split(",")
            if srcset:
                source = srcset[-1].strip().split(" ", 1)[0]
                if source:
                    self._add_image(source, 11)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    def close(self) -> None:
        super().close()
        if not self.page_title:
            self.page_title = " ".join(" ".join(self.title_parts).split())

    def _add_image(self, source: str, priority: int) -> None:
        image_url = urljoin(self.base_url, source.strip())
        try:
            parsed = urlsplit(image_url)
        except ValueError:
            return
        if parsed.scheme == "https" and parsed.hostname and len(image_url) <= MAX_URL_LENGTH:
            self.candidates.append((priority, image_url))


def extract_page_details(html: str, page_url: str) -> dict[str, Any]:
    parser = _RobotPageParser(page_url)
    parser.feed(html)
    parser.close()
    images = list(dict.fromkeys(url for _, url in sorted(parser.candidates)))[:20]
    if not images:
        raise RobotPageImportError(
            "No robot image was found on that page. Try a product page with an Open Graph image."
        )
    return {"title": parser.page_title or urlsplit(page_url).hostname or "Robot model", "images": images}


def import_robot_page(url: Any) -> dict[str, Any]:
    if not isinstance(url, str) or not url.strip():
        raise RobotPageImportError("Enter a robot product page URL.")
    html, final_url = _read_product_page(url.strip())
    details = extract_page_details(html, final_url)
    details["page_url"] = final_url
    return details
