"""Tests for metadata_sync.py - CapCut metadata synchronization."""

import json
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from metadata_sync import sync_metadata


class TestSyncMetadata:
    def test_returns_synced_true(self, tmp_draft_dir):
        result = sync_metadata(str(tmp_draft_dir))
        assert result["synced"] is True

    def test_returns_materials_size(self, tmp_draft_dir):
        result = sync_metadata(str(tmp_draft_dir))
        assert "materials_size" in result
        assert isinstance(result["materials_size"], (int, float))

    def test_updates_draft_meta_with_trailing_underscore(self, tmp_draft_dir):
        sync_metadata(str(tmp_draft_dir))

        meta_path = tmp_draft_dir / "draft_meta_info.json"
        with open(meta_path, "r") as f:
            meta = json.load(f)

        # The trailing underscore field MUST exist
        assert "draft_timeline_materials_size_" in meta

    def test_updates_root_meta_without_trailing_underscore(self, tmp_draft_dir):
        sync_metadata(str(tmp_draft_dir))

        # root_meta_info.json is two levels up from draft_dir
        root_meta_path = tmp_draft_dir.parent.parent / "root_meta_info.json"
        if root_meta_path.exists():
            with open(root_meta_path, "r") as f:
                root = json.load(f)
            store = root["all_draft_store"][0]
            # Without trailing underscore
            assert "draft_timeline_materials_size" in store

    def test_sets_cloud_sync_false(self, tmp_draft_dir):
        sync_metadata(str(tmp_draft_dir))

        meta_path = tmp_draft_dir / "draft_meta_info.json"
        with open(meta_path, "r") as f:
            meta = json.load(f)
        assert meta.get("cloud_draft_sync") is False

    def test_updates_timestamp(self, tmp_draft_dir):
        before_us = int(time.time() * 1_000_000)
        sync_metadata(str(tmp_draft_dir))

        meta_path = tmp_draft_dir / "draft_meta_info.json"
        with open(meta_path, "r") as f:
            meta = json.load(f)

        if "tm_draft_modified" in meta:
            assert meta["tm_draft_modified"] >= before_us - 5_000_000  # 5s tolerance

    def test_missing_root_meta_does_not_crash(self, tmp_draft_dir):
        """sync_metadata should not crash if root_meta_info.json is missing."""
        root_meta_path = tmp_draft_dir.parent.parent / "root_meta_info.json"
        if root_meta_path.exists():
            root_meta_path.unlink()

        # Should not raise
        result = sync_metadata(str(tmp_draft_dir))
        assert result["synced"] is True
