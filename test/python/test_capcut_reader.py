"""Tests for capcut_reader.py - CapCut draft reading operations."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from capcut_reader import read_audio_blocks, read_draft, read_subtitles


class TestReadDraft:
    def test_returns_canvas_config(self, mock_draft_path):
        result = read_draft(mock_draft_path)
        assert "canvas_config" in result
        assert result["canvas_config"]["width"] == 1080
        assert result["canvas_config"]["height"] == 1920

    def test_returns_correct_ratio(self, mock_draft_path):
        result = read_draft(mock_draft_path)
        assert result["canvas_config"]["ratio"] == "9:16"

    def test_returns_tracks_summary(self, mock_draft_path):
        result = read_draft(mock_draft_path)
        assert "tracks" in result
        track_types = [t["type"] for t in result["tracks"]]
        assert "audio" in track_types
        assert "text" in track_types
        assert "video" in track_types

    def test_returns_audio_materials(self, mock_draft_path):
        result = read_draft(mock_draft_path)
        assert "audio_materials" in result
        assert len(result["audio_materials"]) == 5
        for mat in result["audio_materials"]:
            assert "id" in mat
            assert "path" in mat
            assert "duration" in mat

    def test_returns_text_materials(self, mock_draft_path):
        result = read_draft(mock_draft_path)
        assert "text_materials" in result
        assert len(result["text_materials"]) == 5

    def test_returns_video_materials(self, mock_draft_path):
        result = read_draft(mock_draft_path)
        assert "video_materials" in result
        assert len(result["video_materials"]) == 2

    def test_file_not_found_raises(self, tmp_path):
        fake_path = str(tmp_path / "nonexistent" / "draft_content.json")
        with pytest.raises((FileNotFoundError, Exception)):
            read_draft(fake_path)


class TestReadAudioBlocks:
    def test_returns_correct_count(self, mock_draft_path):
        blocks = read_audio_blocks(mock_draft_path)
        assert len(blocks) == 5

    def test_blocks_have_required_fields(self, mock_draft_path):
        blocks = read_audio_blocks(mock_draft_path)
        required_fields = ["id", "material_id", "start_ms", "end_ms", "duration_ms"]
        for block in blocks:
            for field in required_fields:
                assert field in block, f"Missing field: {field}"

    def test_blocks_sorted_by_start_ms(self, mock_draft_path):
        blocks = read_audio_blocks(mock_draft_path)
        for i in range(len(blocks) - 1):
            assert blocks[i]["start_ms"] <= blocks[i + 1]["start_ms"]


class TestReadSubtitles:
    def test_returns_text_with_timings(self, mock_draft_path):
        subtitles = read_subtitles(mock_draft_path)
        assert len(subtitles) == 5
        for sub in subtitles:
            assert "text" in sub
            assert "start_ms" in sub or "start_us" in sub
