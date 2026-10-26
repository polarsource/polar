from pydantic import BaseModel

from polar.invoice.renderer import PDFRenderError, render_pdf

from .generator import CreditNote, CreditNoteGenerator

RENDER_TIMEOUT_SECONDS = 60.0


class CreditNoteRenderRequest(BaseModel):
    credit_note: CreditNote


class CreditNoteRenderError(Exception): ...


async def render_credit_note_pdf(credit_note: CreditNote) -> bytes:
    payload = CreditNoteRenderRequest(credit_note=credit_note).model_dump_json()
    try:
        return await render_pdf(_generate_pdf, payload, timeout=RENDER_TIMEOUT_SECONDS)
    except PDFRenderError as e:
        raise CreditNoteRenderError(f"Credit note {e}") from e


def _generate_pdf(payload: str) -> bytes:
    request = CreditNoteRenderRequest.model_validate_json(payload)
    generator = CreditNoteGenerator(request.credit_note, heading_title="Credit Note")
    generator.generate()
    output = generator.output()
    assert isinstance(output, bytearray)
    return bytes(output)
