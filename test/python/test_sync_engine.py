"""Tests for sync_engine.py - Timeline synchronization operations.

These tests are marked as slow since they involve full draft read/write cycles.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from sync_engine import apply_animations_to_images, flatten_audio_tracks, sync_project


@pytest.mark.slow
class TestSyncProject:
    def test_sync_returns_success(self, mock_draft_path):
        result = sync_project(mock_draft_path)
        assert result.get("success") is True

    def test_sync_preserves_audio_segments(self, mock_draft_path):
        # Read audio count before sync
        with open(mock_draft_path, "r") as f:
            before = json.load(f)
        audio_segs_before = sum(
            len(t.get("segments", []))
            for t in before["tracks"]
            if t["type"] == "audio"
        )

        sync_project(mock_draft_path)

        with open(mock_draft_path, "r") as f:
            after = json.load(f)
        # Count audio segments across all audio tracks
        audio_segs_after = sum(
            len(t.get("segments", []))
            for t in after["tracks"]
            if t["type"] == "audio"
        )
        assert audio_segs_after == audio_segs_before

    def test_sync_updates_metadata(self, tmp_draft_dir, mock_draft_path):
        sync_project(mock_draft_path)

        meta_path = tmp_draft_dir / "draft_meta_info.json"
        if meta_path.exists():
            with open(meta_path, "r") as f:
                meta = json.load(f)
            assert "draft_timeline_materials_size_" in meta


@pytest.mark.slow
class TestApplyAnimations:
    def test_returns_applied_count(self, mock_draft_path):
        result = apply_animations_to_images(mock_draft_path)
        assert "applied" in result
        assert isinstance(result["applied"], int)


@pytest.mark.slow
class TestFlattenAudio:
    def test_flatten_returns_success(self, mock_draft_path):
        result = flatten_audio_tracks(mock_draft_path)
        assert result.get("success") is True

    def test_flatten_produces_single_audio_track(self, mock_draft_path):
        flatten_audio_tracks(mock_draft_path)

        with open(mock_draft_path, "r") as f:
            draft = json.load(f)
        audio_tracks = [t for t in draft["tracks"] if t["type"] == "audio"]
        assert len(audio_tracks) == 1
