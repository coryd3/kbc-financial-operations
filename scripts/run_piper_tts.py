#!/usr/bin/env python3
"""Generate local audiobook WAV files from TTS chunks using Piper."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIOBOOK_DIR = ROOT / "dist" / "audiobook"
CHUNKS_DIR = AUDIOBOOK_DIR / "chunks"
AUDIO_DIR = AUDIOBOOK_DIR / "audio"
VOICE_DIR = AUDIOBOOK_DIR / "piper-voices"
DEFAULT_VOICE = "en_US-lessac-medium"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local Piper TTS over generated audiobook chunks.")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Piper voice model name. Default: {DEFAULT_VOICE}.")
    parser.add_argument("--data-dir", default=str(VOICE_DIR), help="Directory where Piper voice files are stored.")
    parser.add_argument("--chunks-dir", default=str(CHUNKS_DIR), help="Directory containing generated .txt chunks.")
    parser.add_argument("--audio-dir", default=str(AUDIO_DIR), help="Directory where WAV output files should be written.")
    parser.add_argument("--download-voice", action="store_true", help="Download the selected Piper voice before generating audio.")
    parser.add_argument("--no-audio", action="store_true", help="Download/check setup only; do not generate audio.")
    parser.add_argument("--sample", action="store_true", help="Generate audio for the first chunk only.")
    parser.add_argument("--overwrite", action="store_true", help="Regenerate WAV files that already exist.")
    parser.add_argument("--sentence-silence", default="0.35", help="Silence in seconds between sentences. Default: 0.35.")
    parser.add_argument("--start-sequence", type=int, default=1, help="Start at this chunk sequence number. Default: 1.")
    parser.add_argument("--limit", type=int, default=0, help="Generate at most this many chunks. Default: all selected chunks.")
    parser.add_argument(
        "--work-dir",
        default="",
        help="Local temporary work directory for Piper input/output files. Default: system temp.",
    )
    return parser.parse_args()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, check=False, capture_output=True, text=True)


def piper_available() -> bool:
    result = run([sys.executable, "-m", "piper", "--help"])
    return result.returncode == 0


def print_install_help() -> None:
    print("Piper is not installed or is not available to this Python environment.")
    print("")
    print("Install Piper locally:")
    print("  python -m pip install piper-tts")
    print("")
    print("Then download the default voice:")
    print("  make tts-local-download-voice")
    print("")
    print("Or without make:")
    print("  python scripts/run_piper_tts.py --download-voice --no-audio")


def download_voice(voice: str, data_dir: Path) -> int:
    data_dir.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "piper.download_voices",
        voice,
        "--data-dir",
        str(data_dir),
    ]
    print(f"Downloading Piper voice '{voice}' to {data_dir.relative_to(ROOT)}...")
    result = subprocess.run(command, cwd=ROOT, check=False)
    return result.returncode


def voice_files_present(voice: str, data_dir: Path) -> bool:
    return (data_dir / f"{voice}.onnx").exists() and (data_dir / f"{voice}.onnx.json").exists()


def ensure_chunks() -> int:
    if CHUNKS_DIR.exists() and any(CHUNKS_DIR.glob("*.txt")):
        return 0
    print("Audiobook chunks were not found. Building them first...")
    result = subprocess.run([sys.executable, "scripts/build_audiobook_bundle.py"], cwd=ROOT, check=False)
    return result.returncode


def output_name_for_chunk(chunk: Path) -> str:
    return chunk.with_suffix(".wav").name


def sequence_for_chunk(chunk: Path) -> int:
    try:
        return int(chunk.name.split("-", 1)[0])
    except (IndexError, ValueError):
        return 0


def wav_is_usable(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 44:
        return False
    try:
        with wave.open(str(path), "rb") as wav_file:
            return wav_file.getnchannels() > 0 and wav_file.getframerate() > 0 and wav_file.getnframes() > 0
    except (EOFError, OSError, wave.Error):
        return False


def generate_audio(args: argparse.Namespace) -> int:
    chunks_dir = Path(args.chunks_dir)
    audio_dir = Path(args.audio_dir)
    data_dir = Path(args.data_dir)

    if ensure_chunks() != 0:
        return 1

    chunks = sorted(chunks_dir.glob("*.txt"))
    if args.start_sequence > 1:
        chunks = [chunk for chunk in chunks if sequence_for_chunk(chunk) >= args.start_sequence]
    if args.sample:
        chunks = chunks[:1]
    if args.limit > 0:
        chunks = chunks[: args.limit]

    if not chunks:
        print(f"No chunk files found in {chunks_dir}.")
        return 1

    audio_dir.mkdir(parents=True, exist_ok=True)
    generated: list[Path] = []
    skipped = 0
    regenerated_invalid = 0
    generated_this_run = 0

    temp_parent = Path(args.work_dir) if args.work_dir else Path(tempfile.gettempdir())
    temp_parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="kbc-piper-", dir=temp_parent) as temp_dir_name:
        temp_dir = Path(temp_dir_name)

        for index, chunk in enumerate(chunks, start=1):
            output_file = audio_dir / output_name_for_chunk(chunk)
            if output_file.exists() and not args.overwrite:
                if wav_is_usable(output_file):
                    skipped += 1
                    generated.append(output_file)
                    continue
                print(f"Existing WAV looked incomplete; regenerating {output_file.name}")
                regenerated_invalid += 1
                output_file.unlink(missing_ok=True)

            print(f"[{index}/{len(chunks)}] Generating {output_file.name}")
            temp_input = temp_dir / chunk.name
            temp_output = temp_dir / output_file.name
            shutil.copy2(chunk, temp_input)
            if temp_output.exists():
                temp_output.unlink()

            command = [
                sys.executable,
                "-m",
                "piper",
                "-m",
                args.voice,
                "--data-dir",
                str(data_dir),
                "--input-file",
                str(temp_input),
                "-f",
                str(temp_output),
                "--sentence-silence",
                str(args.sentence_silence),
            ]
            result = subprocess.run(command, cwd=ROOT, check=False)
            if result.returncode != 0 or not wav_is_usable(temp_output):
                print("")
                print("Piper stopped before all audio files were generated.")
                print("This can happen when Piper cannot finish writing a WAV file.")
                print("The script now writes to a local temp folder first, then copies finished WAVs into the repo.")
                print("Try rerunning the same command; it will skip valid WAV files and resume.")
                return result.returncode or 1

            shutil.copy2(temp_output, output_file)
            generated.append(output_file)
            generated_this_run += 1

    all_valid_wavs = sorted(path for path in audio_dir.glob("*.wav") if wav_is_usable(path))
    playlist = write_playlist(audio_dir, all_valid_wavs)

    print("")
    print("Local Piper audio generation complete.")
    print(f"- Audio folder: {audio_dir.relative_to(ROOT)}")
    print(f"- Playlist: {playlist.relative_to(ROOT)}")
    print(f"- WAV files available: {len(all_valid_wavs)}")
    print(f"- WAV files generated in this run: {generated_this_run}")
    if skipped:
        print(f"- Skipped existing WAV files: {skipped}")
    if regenerated_invalid:
        print(f"- Regenerated incomplete WAV files: {regenerated_invalid}")
    if args.sample:
        print("Sample mode was enabled; only the first chunk was generated.")

    return 0


def write_playlist(audio_dir: Path, files: list[Path]) -> Path:
    playlist = audio_dir / "kbc-financial-operations-audiobook.m3u"
    lines = ["#EXTM3U"]
    for file in files:
        lines.append(file.name)
    playlist.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return playlist


def main() -> int:
    args = parse_args()

    if not piper_available():
        print_install_help()
        return 1

    data_dir = Path(args.data_dir)

    if args.download_voice:
        result = download_voice(args.voice, data_dir)
        if result != 0:
            return result

    if not voice_files_present(args.voice, data_dir):
        print(f"Piper voice files for '{args.voice}' were not found in {data_dir.relative_to(ROOT)}.")
        print("")
        print("Download the voice with:")
        print("  make tts-local-download-voice")
        print("")
        print("Or without make:")
        print(f"  python scripts/run_piper_tts.py --download-voice --no-audio --voice {args.voice}")
        return 1

    if args.no_audio:
        print("Piper setup looks ready.")
        print(f"- Voice: {args.voice}")
        print(f"- Voice directory: {data_dir.relative_to(ROOT)}")
        return 0

    return generate_audio(args)


if __name__ == "__main__":
    sys.exit(main())
