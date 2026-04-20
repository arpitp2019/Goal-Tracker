import argparse
import datetime as dt
import os
import sys
from pathlib import Path

from openai import OpenAI


def _chunk_text(text: str, max_chars: int) -> list[str]:
    """
    Very simple, robust chunker that prefers splitting on paragraph/newline
    boundaries to keep sentence context intact.
    """
    text = (text or "").strip()
    if not text:
        return []

    parts: list[str] = []
    buf: list[str] = []
    buf_len = 0

    for para in text.splitlines():
        # Keep empty lines as separators.
        piece = para.rstrip()
        add = (piece + "\n") if piece else "\n"
        if buf_len + len(add) > max_chars and buf:
            parts.append("".join(buf).strip())
            buf = []
            buf_len = 0
        buf.append(add)
        buf_len += len(add)

    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _ensure_api_key_present() -> None:
    if os.getenv("OPENAI_API_KEY"):
        return
    raise SystemExit(
        "OPENAI_API_KEY is not set.\n\n"
        "PowerShell (current session):\n"
        "  $env:OPENAI_API_KEY = 'your_key_here'\n\n"
        "Then re-run this script."
    )


def transcribe(
    *,
    client: OpenAI,
    audio_path: Path,
    model: str,
    language: str,
    prompt: str | None,
) -> str:
    # OpenAI Audio file uploads are limited to 25MB; fail fast with a clear hint.
    size_mb = audio_path.stat().st_size / (1024 * 1024)
    if size_mb > 25:
        raise SystemExit(
            f"Audio file is {size_mb:.2f} MB, which exceeds the 25 MB upload limit.\n"
            "Convert to a compressed format (e.g., mp3) or split into smaller chunks."
        )

    with audio_path.open("rb") as f:
        # Note: timestamp_granularities are only supported for whisper-1.
        # For gpt-4o* transcribe models, use text/json outputs.
        resp = client.audio.transcriptions.create(
            model=model,
            file=f,
            language=language or None,
            prompt=prompt or None,
            response_format="text",
        )

    # SDK returns a typed object; .text holds the transcript for response_format="text".
    return (getattr(resp, "text", None) or str(resp)).strip()


def summarize_hindi(
    *,
    client: OpenAI,
    transcript: str,
    model: str,
    chunk_chars: int,
) -> tuple[str, str]:
    """
    Returns: (notes_md, final_summary_md)
    """
    chunks = _chunk_text(transcript, max_chars=chunk_chars)
    if not chunks:
        return ("", "## सारांश\n\nट्रांसक्रिप्ट खाली है।\n")

    notes: list[str] = []
    for i, ch in enumerate(chunks, start=1):
        input_text = (
            "आपको नीचे दिए गए ट्रांसक्रिप्ट के हिस्से से संक्षिप्त, सटीक नोट्स बनाने हैं।\n"
            "नियम:\n"
            "- केवल वही लिखें जो स्पष्ट रूप से कहा गया है; अनुमान/मनगढंत चीजें न जोड़ें।\n"
            "- अगर कोई नाम/तारीख/संख्या स्पष्ट नहीं है, तो 'उल्लेख नहीं' लिखें।\n"
            "- आउटपुट हिंदी में, Markdown bullets में दें।\n\n"
            f"ट्रांसक्रिप्ट (भाग {i}/{len(chunks)}):\n{ch}"
        )
        r = client.responses.create(
            model=model,
            input=input_text,
        )
        notes_text = (getattr(r, "output_text", None) or "").strip()
        if not notes_text:
            # Fallback: best-effort extraction from response object.
            notes_text = str(r)
        notes.append(f"### भाग {i}\n\n{notes_text}\n")

    notes_md = "# Notes (Auto)\n\n" + "\n".join(notes).strip() + "\n"

    final_prompt = (
        "नीचे दिए गए नोट्स के आधार पर एक अंतिम, व्यवस्थित सारांश बनाइए।\n"
        "नियम:\n"
        "- केवल नोट्स में मौजूद जानकारी का उपयोग करें; नई बातें न जोड़ें।\n"
        "- आउटपुट हिंदी में Markdown में दें।\n\n"
        "फॉर्मेट:\n"
        "## सारांश\n"
        "## मुख्य बिंदु\n"
        "## निर्णय (यदि कोई)\n"
        "## Action items (यदि कोई)\n"
        "## महत्वपूर्ण तारीखें/समय (यदि कोई)\n\n"
        f"नोट्स:\n{notes_md}"
    )
    r2 = client.responses.create(model=model, input=final_prompt)
    summary_text = (getattr(r2, "output_text", None) or "").strip()
    if not summary_text:
        summary_text = str(r2)
    if not summary_text.startswith("##"):
        summary_text = "## सारांश\n\n" + summary_text

    return (notes_md, summary_text.rstrip() + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe a WAV and summarize it in Hindi.")
    parser.add_argument(
        "--audio",
        default=r"C:\Users\arpit\Downloads\NMIMS.wav",
        help="Path to the audio file (wav/mp3/m4a/webm, etc.).",
    )
    parser.add_argument(
        "--transcribe-model",
        default="gpt-4o-mini-transcribe",
        help="Transcription model (recommended: gpt-4o-mini-transcribe).",
    )
    parser.add_argument(
        "--summary-model",
        default="gpt-5.4-mini",
        help="Text model for summaries (recommended: gpt-5.4-mini).",
    )
    parser.add_argument(
        "--language",
        default="hi",
        help="BCP-47 language tag hint for transcription (e.g. hi, en).",
    )
    parser.add_argument(
        "--prompt",
        default="यह एक हिंदी रिकॉर्डिंग है। ट्रांसक्रिप्शन में विराम-चिह्न जोड़ें और अंग्रेज़ी शब्द/नाम जैसे के तैसे रखें।",
        help="Optional transcription prompt (helps with proper nouns/formatting).",
    )
    parser.add_argument(
        "--out-dir",
        default=str(Path.cwd() / "transcripts"),
        help="Output directory for transcript + summary.",
    )
    parser.add_argument(
        "--chunk-chars",
        type=int,
        default=12000,
        help="Transcript chunk size for summarization (chars).",
    )

    args = parser.parse_args()
    audio_path = Path(args.audio).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()

    if not audio_path.exists():
        print(f"Audio not found: {audio_path}", file=sys.stderr)
        return 2

    _ensure_api_key_present()
    client = OpenAI()

    started = dt.datetime.now()
    print(f"[1/2] Transcribing ({args.transcribe_model})... {audio_path.name}")
    transcript = transcribe(
        client=client,
        audio_path=audio_path,
        model=args.transcribe_model,
        language=args.language,
        prompt=args.prompt,
    )

    stamp = started.strftime("%Y%m%d_%H%M%S")
    transcript_path = out_dir / f"{audio_path.stem}_{stamp}.transcript.{args.language}.txt"
    meta = (
        f"# Transcript\n"
        f"- created: {started.isoformat(timespec='seconds')}\n"
        f"- audio: {audio_path}\n"
        f"- transcribe_model: {args.transcribe_model}\n"
        f"- language_hint: {args.language}\n\n"
    )
    _write_text(transcript_path, meta + transcript + "\n")
    print(f"  wrote: {transcript_path}")

    print(f"[2/2] Summarizing ({args.summary_model})...")
    notes_md, summary_md = summarize_hindi(
        client=client,
        transcript=transcript,
        model=args.summary_model,
        chunk_chars=args.chunk_chars,
    )

    notes_path = out_dir / f"{audio_path.stem}_{stamp}.notes.md"
    summary_path = out_dir / f"{audio_path.stem}_{stamp}.summary.hi.md"
    _write_text(notes_path, notes_md)
    _write_text(summary_path, summary_md)
    print(f"  wrote: {notes_path}")
    print(f"  wrote: {summary_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

