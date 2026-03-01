"""Tests for srt_generator.py - SRT subtitle file generation."""

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from srt_generator import generate_srt


class TestGenerateSrt:
    def test_creates_file(self, tmp_path, mock_srt_blocks):
        output = str(tmp_path / "output.srt")
        generate_srt(mock_srt_blocks, output)
        assert Path(output).exists()

    def test_block_count_matches(self, tmp_path, mock_srt_blocks):
        output = str(tmp_path / "output.srt")
        result = generate_srt(mock_srt_blocks, output)
        assert result["block_count"] == len(mock_srt_blocks)

    def test_srt_format_contains_arrow(self, tmp_path, mock_srt_blocks):
        output = str(tmp_path / "output.srt")
        generate_srt(mock_srt_blocks, output)
        content = Path(output).read_text(encoding="utf-8-sig")
        assert "-->" in content

    def test_timestamps_format(self, tmp_path, mock_srt_blocks):
        output = str(tmp_path / "output.srt")
        generate_srt(mock_srt_blocks, output)
        content = Path(output).read_text(encoding="utf-8-sig")
        # SRT timestamp format: HH:MM:SS,mmm
        pattern = r"\d{2}:\d{2}:\d{2},\d{3}"
        matches = re.findall(pattern, content)
        assert len(matches) >= 2  # at least one start and one end

    def test_sequential_indices(self, tmp_path, mock_srt_blocks):
        output = str(tmp_path / "output.srt")
        generate_srt(mock_srt_blocks, output)
        content = Path(output).read_text(encoding="utf-8-sig")
        entries = [e.strip() for e in content.strip().split("\n\n") if e.strip()]
        for i, entry in enumerate(entries):
            first_line = entry.split("\n")[0].strip()
            assert first_line == str(i + 1)

    def test_text_preserved(self, tmp_path, mock_srt_blocks):
        output = str(tmp_path / "output.srt")
        generate_srt(mock_srt_blocks, output)
        content = Path(output).read_text(encoding="utf-8-sig")
        for block in mock_srt_blocks:
            assert block["text"] in content
