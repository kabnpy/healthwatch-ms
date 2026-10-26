import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import jinja2

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "documents"
FRONTEND_RENDER_SCRIPT = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "frontend"
    / "scripts"
    / "render_pdf.ts"
)


class PdfRendererService:
    """Headless PDF rendering service utilizing Jinja2 templates and Bun+Playwright with fallback."""

    _jinja_env: jinja2.Environment | None = None

    @classmethod
    def get_jinja_env(cls) -> jinja2.Environment:
        if cls._jinja_env is None:
            cls._jinja_env = jinja2.Environment(
                loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
                autoescape=jinja2.select_autoescape(["html", "xml"]),
            )
        return cls._jinja_env

    @classmethod
    def render_html(cls, template_name: str, context: dict[str, Any]) -> str:
        """Renders HTML from a Jinja2 template with context."""
        env = cls.get_jinja_env()
        template = env.get_template(template_name)
        return template.render(**context)

    @staticmethod
    def _generate_fallback_pdf(title: str, text_lines: list[str]) -> bytes:
        """Generates a minimal valid PDF-1.4 document in pure Python without external dependencies."""
        content_lines = ["BT", "/F1 12 Tf", "50 750 Td", "14 TL"]
        escaped_title = (
            title.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        )
        content_lines.append(f"({escaped_title}) '")
        content_lines.append("() '")

        for line in text_lines[:45]:
            escaped = (
                str(line).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            )
            content_lines.append(f"({escaped}) '")
        content_lines.append("ET")

        stream_data = "\n".join(content_lines).encode("latin-1", "replace")
        stream_len = len(stream_data)

        objects = [
            b"%PDF-1.4\n",
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
            f"4 0 obj\n<< /Length {stream_len} >>\nstream\n".encode("latin-1")
            + stream_data
            + b"\nendstream\nendobj\n",
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        ]

        offsets = []
        curr_offset = 0
        pdf_bytes = b""
        for i, obj in enumerate(objects):
            if i > 0:
                offsets.append(curr_offset)
            curr_offset += len(obj)
            pdf_bytes += obj

        xref_offset = curr_offset
        xref = f"xref\n0 {len(objects)}\n0000000000 65535 f \n".encode("latin-1")
        for off in offsets:
            xref += f"{off:010d} 00000 n \n".encode("latin-1")

        trailer = f"trailer\n<< /Size {len(objects)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
            "latin-1"
        )
        return pdf_bytes + xref + trailer

    @classmethod
    def render_pdf(
        cls,
        html_content: str,
        output_path: Path,
        fallback_title: str = "HealthWatch MS Document",
        fallback_lines: list[str] | None = None,
    ) -> Path:
        """
        Renders HTML content into an A4 PDF.
        Attempts Bun + Playwright script first; falls back to pure Python generator if Bun or Playwright fails.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        bun_bin = shutil.which("bun")

        if bun_bin and FRONTEND_RENDER_SCRIPT.exists():
            with tempfile.NamedTemporaryFile(
                "w", suffix=".html", delete=False
            ) as tmp_html:
                tmp_html.write(html_content)
                tmp_html_path = Path(tmp_html.name)

            try:
                cmd = [
                    bun_bin,
                    "run",
                    str(FRONTEND_RENDER_SCRIPT),
                    "--input",
                    str(tmp_html_path),
                    "--output",
                    str(output_path),
                ]
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=20,
                    check=False,
                )
                if (
                    result.returncode == 0
                    and output_path.exists()
                    and output_path.stat().st_size > 0
                ):
                    logger.info(
                        "PDF successfully rendered via Bun Playwright: %s", output_path
                    )
                    return output_path
                else:
                    logger.warning(
                        "Bun Playwright rendering failed (code %d): %s, using fallback",
                        result.returncode,
                        result.stderr,
                    )
            except Exception as e:
                logger.warning(
                    "Bun Playwright rendering encountered exception: %s, using fallback",
                    e,
                )
            finally:
                if tmp_html_path.exists():
                    tmp_html_path.unlink()

        # Fallback to pure Python PDF generator
        logger.info("Generating PDF using pure Python fallback: %s", output_path)
        lines = fallback_lines or [
            "HealthWatch Insurance Agency Ltd",
            "Nairobi, Kenya",
            f"Document Title: {fallback_title}",
            "Rendered via HealthWatch MS Document Pipeline",
        ]
        pdf_bytes = cls._generate_fallback_pdf(fallback_title, lines)
        output_path.write_bytes(pdf_bytes)
        return output_path
