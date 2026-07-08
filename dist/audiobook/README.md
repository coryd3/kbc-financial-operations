# Audiobook and TTS Bundle

This folder contains generated files for listening to the KBC financial operations documentation.

Generated files:

- `kbc-financial-operations-complete-document.md` - a comprehensive compiled Markdown document.
- `kbc-financial-operations-tts-script.txt` - a cleaner text-to-speech script.
- `chunks/` - smaller chapter/part text files for TTS tools.
- `chunk-index.csv` - an index of generated chunk files.

To rebuild:

```sh
make audiobook
```

If `make` is not available:

```sh
python scripts/build_audiobook_bundle.py
```

Review the TTS script before uploading it to a text-to-speech app.

## Local Piper Audio

Install Piper:

```sh
python -m pip install piper-tts
```

Download the default voice:

```sh
make tts-local-download-voice
```

Generate one sample WAV:

```sh
make tts-local-sample
```

Generate all local WAV files:

```sh
make tts-local
```

The full Piper run may take a while because the audiobook is split into many chunks. Use `make tts-local-sample` first.

If Piper stops partway through with a WAV write error, rerun the same command. The script skips valid WAV files, regenerates incomplete WAV files, and resumes from the remaining chunks.

Generated audio is placed in `dist/audiobook/audio/`, and downloaded voice models are placed in `dist/audiobook/piper-voices/`. Both folders are ignored by Git.

Do not add donor records, payroll details, bank account numbers, passwords, Social Security numbers, confidential personnel issues, actual applications, reference checks, background-check results, or private financial data to these generated files.
