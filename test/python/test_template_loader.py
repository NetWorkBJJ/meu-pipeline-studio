"""Tests for template_loader.py - CapCut template management."""

import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "executions"))

from template_loader import load_template


class TestLoadTemplate:
    def test_returns_dict(self):
        result = load_template("text_material_template")
        assert isinstance(result, dict)
        assert len(result) > 0

    def test_deep_copy_safety(self):
        """Modifying the returned template must not affect future calls."""
        first = load_template("text_material_template")
        first["_mutated"] = True

        second = load_template("text_material_template")
        assert "_mutated" not in second

    def test_not_found_raises(self):
        with pytest.raises((FileNotFoundError, Exception)):
            load_template("nonexistent_template_that_does_not_exist")
