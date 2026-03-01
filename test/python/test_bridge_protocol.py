"""Tests for the Python bridge JSON-line protocol (main_bridge.py).

Spawns the bridge process and validates request/response format,
error handling, and multi-request sessions.
"""

import json
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

BRIDGE_PATH = str(Path(__file__).parent.parent.parent / "executions" / "main_bridge.py")


def run_bridge(input_lines: str, timeout: int = 15) -> subprocess.CompletedProcess:
    """Run the bridge process with the given stdin input."""
    return subprocess.run(
        [sys.executable, BRIDGE_PATH],
        input=input_lines,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def parse_responses(stdout: str) -> list:
    """Parse JSON-line responses from bridge stdout."""
    responses = []
    for line in stdout.strip().split("\n"):
        line = line.strip()
        if line:
            try:
                responses.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return responses


@pytest.mark.bridge
class TestBridgeProtocol:
    def test_ping_returns_ok(self):
        """Bridge ping method returns ok=true with a PID."""
        request = json.dumps({"id": "ping-1", "method": "ping", "params": {}})
        result = run_bridge(request + "\n")

        assert result.returncode == 0
        responses = parse_responses(result.stdout)
        assert len(responses) >= 1

        resp = responses[0]
        assert resp["id"] == "ping-1"
        assert "result" in resp
        assert resp["result"]["ok"] is True
        assert isinstance(resp["result"]["pid"], int)

    def test_unknown_method_returns_error(self):
        """Unknown method name returns an error response."""
        request = json.dumps({"id": "err-1", "method": "nonexistent_method", "params": {}})
        result = run_bridge(request + "\n")

        responses = parse_responses(result.stdout)
        assert len(responses) >= 1

        resp = responses[0]
        assert resp["id"] == "err-1"
        assert "error" in resp
        assert "message" in resp["error"]

    def test_multiple_sequential_requests(self):
        """Bridge handles multiple requests in a single session."""
        requests = ""
        requests += json.dumps({"id": "seq-1", "method": "ping", "params": {}}) + "\n"
        requests += json.dumps({"id": "seq-2", "method": "ping", "params": {}}) + "\n"
        requests += json.dumps({"id": "seq-3", "method": "ping", "params": {}}) + "\n"

        result = run_bridge(requests)
        responses = parse_responses(result.stdout)
        assert len(responses) == 3

        for i, resp in enumerate(responses):
            assert resp["id"] == f"seq-{i+1}"
            assert "result" in resp

    def test_invalid_json_recovery(self):
        """Bridge recovers from invalid JSON and processes next valid request."""
        requests = "this is not json\n"
        requests += json.dumps({"id": "after-invalid", "method": "ping", "params": {}}) + "\n"

        result = run_bridge(requests)
        responses = parse_responses(result.stdout)

        # At least the valid request should have a response
        valid_responses = [r for r in responses if r.get("id") == "after-invalid"]
        assert len(valid_responses) == 1
        assert "result" in valid_responses[0]

    def test_missing_params_returns_error(self):
        """Missing required params returns an error."""
        request = json.dumps({"id": "missing-1", "method": "read_draft", "params": {}})
        result = run_bridge(request + "\n")

        responses = parse_responses(result.stdout)
        assert len(responses) >= 1

        resp = responses[0]
        assert resp["id"] == "missing-1"
        assert "error" in resp

    def test_response_ids_match_requests(self):
        """Each response ID matches its corresponding request ID."""
        ids = [str(uuid.uuid4()) for _ in range(5)]
        requests = ""
        for req_id in ids:
            requests += json.dumps({"id": req_id, "method": "ping", "params": {}}) + "\n"

        result = run_bridge(requests)
        responses = parse_responses(result.stdout)

        response_ids = [r["id"] for r in responses]
        for req_id in ids:
            assert req_id in response_ids

    def test_file_not_found_error(self, tmp_path):
        """Requesting a nonexistent draft path returns a file error."""
        fake_path = str(tmp_path / "nonexistent" / "draft_content.json")
        request = json.dumps({
            "id": "notfound-1",
            "method": "read_draft",
            "params": {"draft_path": fake_path},
        })
        result = run_bridge(request + "\n")

        responses = parse_responses(result.stdout)
        assert len(responses) >= 1

        resp = responses[0]
        assert resp["id"] == "notfound-1"
        assert "error" in resp

    def test_process_exits_cleanly_on_stdin_close(self):
        """Bridge exits with code 0 when stdin is closed."""
        proc = subprocess.Popen(
            [sys.executable, BRIDGE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        proc.stdin.close()
        proc.wait(timeout=10)
        assert proc.returncode == 0
