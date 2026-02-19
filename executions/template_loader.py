"""Template loader for CapCut JSON templates with caching."""

import copy
import json
from pathlib import Path

_templates_cache: dict = {}


def _get_templates_dir() -> Path:
    """Resolve path to templates/ directory relative to this script."""
    return Path(__file__).parent / "templates"


def load_template(name: str) -> dict:
    """Load a JSON template from disk with caching.

    Args:
        name: Template name without .json extension.

    Returns:
        Deep copy of the template dict (safe to mutate).
    """
    if name not in _templates_cache:
        tpath = _get_templates_dir() / f"{name}.json"
        if not tpath.exists():
            raise FileNotFoundError(f"Template not found: {tpath}")
        with open(tpath, "r", encoding="utf-8") as f:
            _templates_cache[name] = json.load(f)
    return copy.deepcopy(_templates_cache[name])
