"""Tests for capcut_writer.py - CapCut draft write operations."""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from capcut_writer import (
    clear_text_segments,
    clear_video_segments,
    create_backup,
    update_subtitle_timings,
    write_text_segments,
    write_video_segments,
)


class TestWriteTextSegments:
    def test_creates_text_track(self, mock_draft_path, mock_text_blocks):
        # First clear existing text to test creation from scratch
        clear_text_segments(mock_draft_path)
        result = write_text_segments(mock_draft_path, mock_text_blocks)

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        text_tracks = [t for t in draft["tracks"] if t["type"] == "text"]
        assert len(text_tracks) >= 1

    def test_returns_correct_count(self, mock_draft_path, mock_text_blocks):
        clear_text_segments(mock_draft_path)
        result = write_text_segments(mock_draft_path, mock_text_blocks)
        assert result["added_count"] == len(mock_text_blocks)

    def test_creates_materials(self, mock_draft_path, mock_text_blocks):
        clear_text_segments(mock_draft_path)
        write_text_segments(mock_draft_path, mock_text_blocks)

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        assert len(draft["materials"]["texts"]) == len(mock_text_blocks)

    def test_creates_animation_materials(self, mock_draft_path, mock_text_blocks):
        clear_text_segments(mock_draft_path)
        write_text_segments(mock_draft_path, mock_text_blocks)

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        assert len(draft["materials"]["material_animations"]) >= len(mock_text_blocks)

    def test_timings_in_microseconds(self, mock_draft_path, mock_text_blocks):
        clear_text_segments(mock_draft_path)
        write_text_segments(mock_draft_path, mock_text_blocks)

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        text_tracks = [t for t in draft["tracks"] if t["type"] == "text"]
        if text_tracks:
            seg = text_tracks[0]["segments"][0]
            # start_ms=0 -> start_us=0, duration_ms=5000 -> duration_us=5000000
            assert seg["target_timerange"]["duration"] == 5000000

    def test_segments_have_material_id(self, mock_draft_path, mock_text_blocks):
        clear_text_segments(mock_draft_path)
        result = write_text_segments(mock_draft_path, mock_text_blocks)
        for seg in result["segments"]:
            assert "material_id" in seg
            assert seg["material_id"]  # not empty


class TestWriteVideoSegments:
    def test_creates_video_track(self, mock_draft_path, tmp_path):
        clear_video_segments(mock_draft_path)
        # Create fake media files
        media_file = tmp_path / "test_video.mp4"
        media_file.write_text("fake video data " * 100)

        scenes = [{"media_path": str(media_file), "start_ms": 0, "end_ms": 5000, "media_type": "video"}]
        result = write_video_segments(mock_draft_path, scenes)

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        video_tracks = [t for t in draft["tracks"] if t["type"] == "video"]
        assert len(video_tracks) >= 1

    def test_returns_correct_count(self, mock_draft_path, tmp_path):
        clear_video_segments(mock_draft_path)
        media1 = tmp_path / "vid1.mp4"
        media2 = tmp_path / "vid2.mp4"
        media1.write_text("fake")
        media2.write_text("fake")

        scenes = [
            {"media_path": str(media1), "start_ms": 0, "end_ms": 5000, "media_type": "video"},
            {"media_path": str(media2), "start_ms": 5000, "end_ms": 10000, "media_type": "video"},
        ]
        result = write_video_segments(mock_draft_path, scenes)
        assert result["added_count"] == 2

    def test_preserves_existing_audio_track(self, mock_draft_path, tmp_path):
        media_file = tmp_path / "test.mp4"
        media_file.write_text("fake")

        # Read audio count before
        with open(mock_draft_path, "r") as f:
            before = json.load(f)
        audio_before = len([t for t in before["tracks"] if t["type"] == "audio"])

        clear_video_segments(mock_draft_path)
        write_video_segments(mock_draft_path, [
            {"media_path": str(media_file), "start_ms": 0, "end_ms": 5000, "media_type": "video"}
        ])

        with open(mock_draft_path, "r") as f:
            after = json.load(f)
        audio_after = len([t for t in after["tracks"] if t["type"] == "audio"])
        assert audio_after == audio_before


class TestClearSegments:
    def test_clear_text_segments(self, mock_draft_path):
        result = clear_text_segments(mock_draft_path)
        assert result["removed_segments"] >= 0

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        text_tracks = [t for t in draft["tracks"] if t["type"] == "text"]
        for track in text_tracks:
            assert len(track.get("segments", [])) == 0

    def test_clear_video_segments(self, mock_draft_path):
        result = clear_video_segments(mock_draft_path)
        assert result["removed_segments"] >= 0

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        video_tracks = [t for t in draft["tracks"] if t["type"] == "video"]
        for track in video_tracks:
            assert len(track.get("segments", [])) == 0

    def test_clear_preserves_audio(self, mock_draft_path):
        # Read audio before
        with open(mock_draft_path, "r") as f:
            before = json.load(f)
        audio_segs_before = sum(
            len(t.get("segments", []))
            for t in before["tracks"]
            if t["type"] == "audio"
        )

        clear_text_segments(mock_draft_path)
        clear_video_segments(mock_draft_path)

        with open(mock_draft_path, "r") as f:
            after = json.load(f)
        audio_segs_after = sum(
            len(t.get("segments", []))
            for t in after["tracks"]
            if t["type"] == "audio"
        )
        assert audio_segs_after == audio_segs_before


class TestUpdateSubtitleTimings:
    def test_with_correct_ids(self, mock_draft_path, mock_text_blocks):
        # Write text first to get material IDs
        clear_text_segments(mock_draft_path)
        write_result = write_text_segments(mock_draft_path, mock_text_blocks)

        timing_updates = []
        for i, seg in enumerate(write_result["segments"]):
            timing_updates.append({
                "material_id": seg["material_id"],
                "start_ms": i * 5000 + 100,
                "end_ms": (i + 1) * 5000 + 100,
            })

        result = update_subtitle_timings(mock_draft_path, timing_updates)
        assert result["updated_count"] == len(mock_text_blocks)

    def test_with_wrong_audio_ids_returns_zero(self, mock_draft_path, mock_text_blocks):
        """Regression test for bug #1: using audio IDs should update 0 text segments."""
        clear_text_segments(mock_draft_path)
        write_text_segments(mock_draft_path, mock_text_blocks)

        # Use audio material IDs (wrong!) to try to update text timings
        wrong_updates = []
        for i in range(5):
            wrong_updates.append({
                "material_id": f"audio-mat-{i+1:03d}",
                "start_ms": i * 5000,
                "end_ms": (i + 1) * 5000,
            })

        result = update_subtitle_timings(mock_draft_path, wrong_updates)
        assert result["updated_count"] == 0


class TestCreateBackup:
    def test_backup_file_created(self, mock_draft_path):
        backup_path = create_backup(mock_draft_path)
        assert backup_path is not None
        assert os.path.exists(backup_path)
