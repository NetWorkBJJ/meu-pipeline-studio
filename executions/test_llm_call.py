"""
Test script to diagnose LLM CLI call issues.
Run: python3 executions/test_llm_call.py
"""

import subprocess
import shutil
import sys
import os
import time
import tempfile
import json


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def clean_env() -> dict:
    """Return env dict without CLAUDECODE vars (prevents nested session error)."""
    env = dict(os.environ)
    for key in list(env.keys()):
        if key.startswith("CLAUDECODE"):
            del env[key]
    return env


def test_1_cli_exists():
    """Test 1: Check if claude CLI is found."""
    log("=== TEST 1: CLI existence ===")
    path = shutil.which("claude")
    if path:
        log(f"PASS - claude found at: {path}")
        return path
    else:
        log("FAIL - claude not found on PATH")
        log(f"  PATH = {os.environ.get('PATH', 'NOT SET')}")
        return None


def test_2_simple_arg(cli_path: str):
    """Test 2: Simple prompt passed as CLI argument."""
    log("=== TEST 2: Simple prompt as argument ===")
    cmd = [cli_path, "--print", "--model", "haiku", "Respond with just the word OK"]
    log(f"  cmd: {cmd}")

    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            encoding="utf-8",
            env=clean_env(),
        )
        elapsed = time.time() - start
        log(f"  returncode: {result.returncode}")
        log(f"  stdout ({len(result.stdout)} chars): {result.stdout.strip()[:200]}")
        log(f"  stderr ({len(result.stderr)} chars): {result.stderr.strip()[:200]}")
        log(f"  elapsed: {elapsed:.1f}s")

        if result.returncode == 0 and result.stdout.strip():
            log("PASS")
        else:
            log("FAIL - non-zero return or empty stdout")
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        log(f"FAIL - TIMEOUT after {elapsed:.1f}s")
    except Exception as e:
        log(f"FAIL - Exception: {e}")


def test_3_stdin_pipe(cli_path: str):
    """Test 3: Prompt via stdin (simulates large prompt path)."""
    log("=== TEST 3: Prompt via stdin file ===")
    prompt = "Respond with just the word OK"

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.txt', prefix='llm_test_')
    try:
        with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
            f.write(prompt)

        cmd = [cli_path, "--print", "--model", "haiku"]
        log(f"  cmd: {cmd}")
        log(f"  stdin file: {tmp_path} ({len(prompt)} chars)")

        start = time.time()
        with open(tmp_path, 'r', encoding='utf-8') as stdin_file:
            result = subprocess.run(
                cmd,
                stdin=stdin_file,
                capture_output=True,
                text=True,
                timeout=60,
                encoding="utf-8",
                env=clean_env(),
            )
        elapsed = time.time() - start
        log(f"  returncode: {result.returncode}")
        log(f"  stdout ({len(result.stdout)} chars): {result.stdout.strip()[:200]}")
        log(f"  stderr ({len(result.stderr)} chars): {result.stderr.strip()[:200]}")
        log(f"  elapsed: {elapsed:.1f}s")

        if result.returncode == 0 and result.stdout.strip():
            log("PASS")
        else:
            log("FAIL - non-zero return or empty stdout")
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        log(f"FAIL - TIMEOUT after {elapsed:.1f}s")
    except Exception as e:
        log(f"FAIL - Exception: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def test_4_large_prompt_stdin(cli_path: str):
    """Test 4: Large prompt (>6000 chars) via stdin - the actual code path used."""
    log("=== TEST 4: Large prompt via stdin (>6000 chars) ===")

    # Simulate a realistic prompt similar to what generate_prompts sends
    prompt = """You are a cinematic director generating visual prompts.

Generate exactly 2 takes in the following format:

(TAKE 1)
A wide establishing shot of a modern city skyline at sunset, golden hour lighting casting long shadows across glass buildings, cinematic composition with rule of thirds.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: -
Environment Lock: Modern city at sunset

(TAKE 2)
A close-up shot of a person walking through a busy street, shallow depth of field, natural lighting, documentary style.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: -
Environment Lock: Busy urban street

---

Script text for the scenes:
"""
    # Pad to exceed 6000 chars
    prompt += "Lorem ipsum dolor sit amet. " * 250
    prompt += "\n\nGenerate exactly 2 takes following the format above."

    log(f"  prompt length: {len(prompt)} chars (>6000 = stdin path)")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.txt', prefix='llm_test_')
    try:
        with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
            f.write(prompt)

        cmd = [cli_path, "--print", "--model", "haiku"]
        log(f"  cmd: {cmd}")

        start = time.time()
        with open(tmp_path, 'r', encoding='utf-8') as stdin_file:
            result = subprocess.run(
                cmd,
                stdin=stdin_file,
                capture_output=True,
                text=True,
                timeout=120,
                encoding="utf-8",
                env=clean_env(),
            )
        elapsed = time.time() - start
        log(f"  returncode: {result.returncode}")
        log(f"  stdout ({len(result.stdout)} chars): {result.stdout.strip()[:500]}")
        log(f"  stderr ({len(result.stderr)} chars): {result.stderr.strip()[:300]}")
        log(f"  elapsed: {elapsed:.1f}s")

        if result.returncode == 0 and result.stdout.strip():
            # Try to parse takes
            from llm_director import parse_takes
            takes = parse_takes(result.stdout)
            log(f"  parsed takes: {len(takes)}")
            for t in takes:
                log(f"    TAKE {t['take_number']}: {t['description'][:80]}...")
            log("PASS")
        else:
            log("FAIL - non-zero return or empty stdout")
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        log(f"FAIL - TIMEOUT after {elapsed:.1f}s")
    except Exception as e:
        log(f"FAIL - Exception: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def test_5_generate_prompts_integration():
    """Test 5: Full integration test through generate_prompts function."""
    log("=== TEST 5: Full generate_prompts() integration ===")

    sys.path.insert(0, os.path.dirname(__file__))
    from llm_director import generate_prompts

    params = {
        "provider": "claude",
        "model": "haiku",
        "system_prompt": """You are a cinematic director. Generate visual prompts in TAKE format.
Each take must follow this EXACT format:

(TAKE N)
[camera movement] description of the visual scene.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: [character name or -]
Environment Lock: [location/setting]""",
        "user_message": """Generate 2 takes for these scenes:

Scene 1 (3.5s): "Welcome to the future of technology"
Scene 2 (4.0s): "Where innovation meets creativity"

Use take numbers starting from 1."""
    }

    log(f"  system_prompt: {len(params['system_prompt'])} chars")
    log(f"  user_message: {len(params['user_message'])} chars")
    log(f"  full_prompt will be: {len(params['system_prompt']) + len(params['user_message']) + 7} chars")

    # Clean CLAUDECODE env vars so _call_llm subprocess works
    saved_env = {}
    for key in list(os.environ.keys()):
        if key.startswith("CLAUDECODE"):
            saved_env[key] = os.environ.pop(key)

    start = time.time()
    try:
        result = generate_prompts(params)
        elapsed = time.time() - start

        log(f"  success: {result.get('success')}")
        log(f"  total takes: {result.get('total')}")
        log(f"  error: {result.get('error', 'none')}")
        log(f"  raw_response ({len(result.get('raw_response', ''))} chars): {result.get('raw_response', '')[:300]}")
        log(f"  elapsed: {elapsed:.1f}s")

        if result.get('success') and result.get('total', 0) > 0:
            for t in result['takes']:
                log(f"    TAKE {t['take_number']}: {t['description'][:80]}...")
            log("PASS")
        else:
            log(f"FAIL - success={result.get('success')}, total={result.get('total')}")
            if result.get('raw_response'):
                log(f"  raw_response full:\n{result['raw_response']}")
    except Exception as e:
        elapsed = time.time() - start
        log(f"FAIL - Exception after {elapsed:.1f}s: {e}")
    finally:
        os.environ.update(saved_env)


def test_6_subprocess_no_hang():
    """Test 6: Verify subprocess doesn't hang with Popen (diagnostic)."""
    log("=== TEST 6: Popen diagnostic (no hang check) ===")
    cli_path = shutil.which("claude")
    if not cli_path:
        log("SKIP - claude not found")
        return

    cmd = [cli_path, "--print", "--model", "haiku", "Say OK"]
    log(f"  cmd: {cmd}")
    log("  Using Popen to monitor process state...")

    start = time.time()
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env=clean_env(),
    )
    log(f"  PID: {proc.pid}")

    # Poll every 2s for up to 60s
    max_wait = 60
    while time.time() - start < max_wait:
        ret = proc.poll()
        elapsed = time.time() - start
        if ret is not None:
            stdout = proc.stdout.read() if proc.stdout else ""
            stderr = proc.stderr.read() if proc.stderr else ""
            log(f"  Process exited with code {ret} after {elapsed:.1f}s")
            log(f"  stdout ({len(stdout)} chars): {stdout.strip()[:200]}")
            log(f"  stderr ({len(stderr)} chars): {stderr.strip()[:200]}")
            if ret == 0 and stdout.strip():
                log("PASS")
            else:
                log("FAIL")
            return
        log(f"  ... still running ({elapsed:.0f}s)")
        time.sleep(2)

    # If we get here, it hung
    elapsed = time.time() - start
    log(f"FAIL - Process still running after {elapsed:.1f}s, killing...")
    proc.kill()
    proc.wait()
    log("  Process killed")


if __name__ == "__main__":
    log("Starting LLM CLI diagnostic tests")
    log(f"Python: {sys.executable} ({sys.version})")
    log(f"Platform: {sys.platform}")
    log(f"CWD: {os.getcwd()}")
    log("")

    cli_path = test_1_cli_exists()
    log("")

    if not cli_path:
        log("Cannot continue without claude CLI. Exiting.")
        sys.exit(1)

    test_2_simple_arg(cli_path)
    log("")

    test_3_stdin_pipe(cli_path)
    log("")

    test_4_large_prompt_stdin(cli_path)
    log("")

    test_5_generate_prompts_integration()
    log("")

    test_6_subprocess_no_hang()
    log("")

    log("All tests completed.")
