"""Tests for draft_io.py - Centralized draft file I/O."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from draft_io import read_draft, save_draft


class TestReadDraft:
    def test_reads_draft_content(self, mock_draft_path):
        draft = read_draft(mock_draft_path)
        assert isinstance(draft, dict)
        assert "canvas_config" in draft
        assert "tracks" in draft

    def test_raises_on_missing_file(self, tmp_path):
        fake = str(tmp_path / "missing" / "draft_content.json")
        with pytest.raises((FileNotFoundError, Exception)):
            read_draft(fake)


class TestSaveDraft:
    def test_writes_main_file(self, mock_draft_path):
        draft = read_draft(mock_draft_path)
        draft["_test_marker"] = True
        save_draft(draft, mock_draft_path, sync_meta=False)

        with open(mock_draft_path, "r", encoding="utf-8") as f:
            reloaded = json.load(f)
        assert reloaded.get("_test_marker") is True

    def test_save_with_sync_meta(self, mock_draft_path, tmp_draft_dir):
        draft = read_draft(mock_draft_path)
        result = save_draft(draft, mock_draft_path, sync_meta=True)
        assert result.get("metadata_synced") is True or result.get("written_files", 0) >= 1

    def test_preserves_all_fields(self, mock_draft_path):
        draft = read_draft(mock_draft_path)
        original_keys = set(draft.keys())

        save_draft(draft, mock_draft_path, sync_meta=False)
        reloaded = read_draft(mock_draft_path)

        for key in original_keys:
            assert key in reloaded, f"Key '{key}' was lost after save"
