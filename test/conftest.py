"""Shared pytest fixtures for MEU PIPELINE STUDIO test suite."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"
EXECUTIONS_DIR = Path(__file__).parent.parent / "executions"


@pytest.fixture
def tmp_draft_dir(tmp_path):
    """Create a temporary CapCut-like directory structure with mock fixtures.

    Structure: tmp_path/com.lveditor.draft/test-draft-fixture-001/
    Copies: draft_content.json, draft_meta_info.json
    Also creates root_meta_info.json two levels up.
    """
    draft_dir = tmp_path / "com.lveditor.draft" / "test-draft-fixture-001"
    draft_dir.mkdir(parents=True)

    shutil.copy(FIXTURES_DIR / "mock_draft_content.json", draft_dir / "draft_content.json")
    shutil.copy(FIXTURES_DIR / "mock_draft_meta_info.json", draft_dir / "draft_meta_info.json")

    root_meta_dest = tmp_path / "root_meta_info.json"
    shutil.copy(FIXTURES_DIR / "mock_root_meta_info.json", root_meta_dest)

    return draft_dir


@pytest.fixture
def mock_draft_path(tmp_draft_dir):
    """Return path to draft_content.json inside tmp_draft_dir."""
    return str(tmp_draft_dir / "draft_content.json")


@pytest.fixture
def mock_audio_blocks():
    """Return 5 mock audio block dicts with sequential 5-second timings."""
    blocks = []
    for i in range(5):
        blocks.append({
            "id": f"audio-seg-{i+1:03d}",
            "material_id": f"audio-mat-{i+1:03d}",
            "start_ms": i * 5000.0,
            "end_ms": (i + 1) * 5000.0,
            "duration_ms": 5000.0,
            "file_path": f"##tts_audio_{i+1}.mp3",
            "tone_type": "BV700_streaming",
            "tone_platform": "volcengine",
            "track_index": 0,
        })
    return blocks


@pytest.fixture
def mock_text_blocks():
    """Return 5 mock text block dicts for writing."""
    texts = [
        "First subtitle block text.",
        "Second subtitle block text.",
        "Third subtitle block text.",
        "Fourth subtitle block text.",
        "Fifth subtitle block text.",
    ]
    blocks = []
    for i, text in enumerate(texts):
        blocks.append({
            "text": text,
            "start_ms": i * 5000.0,
            "end_ms": (i + 1) * 5000.0,
        })
    return blocks


@pytest.fixture
def mock_srt_blocks():
    """Return 5 mock SRT block dicts."""
    texts = [
        "First subtitle block text.",
        "Second subtitle block text.",
        "Third subtitle block text.",
        "Fourth subtitle block text.",
        "Fifth subtitle block text.",
    ]
    blocks = []
    for i, text in enumerate(texts):
        blocks.append({
            "index": i + 1,
            "text": text,
            "start_ms": i * 5000.0,
            "end_ms": (i + 1) * 5000.0,
        })
    return blocks


class BridgeHelper:
    """Helper to send JSON-line requests to the Python bridge process."""

    def __init__(self, proc):
        self.proc = proc

    def send(self, request_dict):
        """Send a JSON request and read the response."""
        line = json.dumps(request_dict) + "\n"
        self.proc.stdin.write(line.encode("utf-8"))
        self.proc.stdin.flush()
        response_line = self.proc.stdout.readline().decode("utf-8").strip()
        if not response_line:
            return None
        return json.loads(response_line)

    def send_raw(self, raw_text):
        """Send raw text (possibly invalid JSON) to the bridge."""
        self.proc.stdin.write((raw_text + "\n").encode("utf-8"))
        self.proc.stdin.flush()

    def read_response(self):
        """Read a single response line."""
        line = self.proc.stdout.readline().decode("utf-8").strip()
        if not line:
            return None
        return json.loads(line)


@pytest.fixture
def bridge_process():
    """Spawn the Python bridge process and yield a BridgeHelper.

    Kills the process on teardown.
    """
    bridge_path = str(EXECUTIONS_DIR / "main_bridge.py")
    proc = subprocess.Popen(
        [sys.executable, bridge_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    helper = BridgeHelper(proc)
    yield helper
    proc.stdin.close()
    proc.terminate()
    proc.wait(timeout=5)
