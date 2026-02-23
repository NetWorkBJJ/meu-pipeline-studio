"""LLM Director: CLI-based LLM integration for scene analysis and prompt generation."""

import subprocess
import shutil
import json
import re
import logging
import sys
import tempfile
import os

log = logging.getLogger("bridge")

# Maps provider name to (cli_binary, non-interactive base args)
CLI_COMMANDS = {
    "claude": ["claude", "--print"],
    "codex": ["codex", "exec"],
    "chatgpt": ["codex", "exec"],
    "gemini": ["gemini"],
}


def _find_cli(provider: str) -> str | None:
    """Check if an LLM CLI tool is available on PATH."""
    cmd_name = CLI_COMMANDS.get(provider, [provider])[0]
    return shutil.which(cmd_name)


def _call_llm(provider: str, prompt: str, model: str = None, timeout: int = 120) -> str:
    """Call an LLM CLI tool in non-interactive mode and return the text response."""
    if provider not in CLI_COMMANDS:
        raise ValueError(f"Unknown LLM provider: {provider}")

    cli_path = _find_cli(provider)
    if not cli_path:
        raise FileNotFoundError(
            f"CLI '{CLI_COMMANDS[provider][0]}' not found on PATH. "
            f"Install it or choose a different provider."
        )

    # Build command with non-interactive flags per provider
    cmd = list(CLI_COMMANDS[provider])
    cmd[0] = cli_path  # Use full resolved path (e.g. C:\...\npm\codex.cmd)

    # Model flag differs per CLI
    if model:
        if provider == "claude":
            cmd.extend(["--model", model])
        else:
            cmd.extend(["-m", model])

    # Windows cmd.exe has ~8191 char command line limit for .cmd wrappers.
    # For large prompts, write to temp file and pipe via stdin instead.
    max_arg_len = 6000
    use_stdin = len(prompt) > max_arg_len

    if use_stdin:
        log.info("Prompt too large for CLI arg (%d chars > %d), using stdin pipe",
                 len(prompt), max_arg_len)

        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.txt', prefix='llm_prompt_')
        try:
            with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
                f.write(prompt)

            log.info("Calling LLM CLI (stdin): %s | cmd: %s | prompt: %d chars",
                     provider, cmd, len(prompt))

            with open(tmp_path, 'r', encoding='utf-8') as stdin_file:
                result = subprocess.run(
                    cmd,
                    stdin=stdin_file,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    encoding="utf-8",
                )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    else:
        # Small prompt: pass as CLI argument
        safe_prompt = prompt
        if sys.platform == "win32" and cli_path.lower().endswith(".cmd"):
            safe_prompt = prompt.replace("%", "%%")

        if provider == "gemini":
            cmd.extend(["--prompt", safe_prompt])
        else:
            cmd.append(safe_prompt)

        log.info("Calling LLM CLI (arg): %s | cmd[0:3]: %s | prompt: %d chars",
                 provider, cmd[:3], len(prompt))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
        )

    log.info("LLM CLI returncode: %d | stdout: %d chars | stderr: %d chars",
             result.returncode, len(result.stdout or ""), len(result.stderr or ""))

    if result.returncode != 0:
        stderr = result.stderr.strip()[:500] if result.stderr else "no stderr"
        log.error("LLM CLI stderr: %s", stderr)
        raise RuntimeError(f"LLM CLI returned error (code {result.returncode}): {stderr}")

    response = result.stdout.strip()
    log.info("LLM response received: %d chars | first 200: %s", len(response), response[:200])
    return response


def _extract_json(text: str) -> dict | list | None:
    """Try to extract JSON from LLM response text."""
    json_match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    for pattern in [r"\{[\s\S]*\}", r"\[[\s\S]*\]"]:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                continue

    return None


def parse_takes(output: str) -> list[dict]:
    """Parse TAKE format output from LLM into structured data."""
    takes = []
    blocks = re.split(r"(?=\(TAKE\s+\d+\))", output)

    for block in blocks:
        header = re.match(r"\(TAKE\s+(\d+)\)", block)
        if not header:
            continue

        take_number = int(header.group(1))
        lines = block[header.end():].strip().split("\n")

        description_lines = []
        negative_prompt = "text, watermark, typography, ui elements."
        character_anchor = "-"
        environment_lock = ""

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            neg = re.match(r"Negative Prompt:\s*(.+)", trimmed, re.IGNORECASE)
            if neg:
                negative_prompt = neg.group(1).strip()
                continue

            char = re.match(r"Character Anchor:\s*(.+)", trimmed, re.IGNORECASE)
            if char:
                character_anchor = char.group(1).strip()
                continue

            env = re.match(r"Environment Lock:\s*(.+)", trimmed, re.IGNORECASE)
            if env:
                environment_lock = env.group(1).strip()
                continue

            description_lines.append(trimmed)

        description = " ".join(description_lines).strip()
        if description:
            takes.append({
                "take_number": take_number,
                "description": description,
                "negative_prompt": negative_prompt,
                "character_anchor": character_anchor,
                "environment_lock": environment_lock,
            })

    return sorted(takes, key=lambda t: t["take_number"])


def check_llm_cli(params):
    """Check if an LLM CLI tool is available."""
    provider = params.get("provider", "claude")
    path = _find_cli(provider)
    return {
        "available": path is not None,
        "path": path,
        "provider": provider,
        "command": CLI_COMMANDS.get(provider, [provider])[0],
    }


def analyze_narrative(params):
    """Analyze the full script and return narrative understanding."""
    provider = params.get("provider", "claude")
    model = params.get("model")
    script_text = params.get("script_text", "")
    scene_count = params.get("scene_count", 0)

    prompt = f"""Analyze the following script/narration and provide a structured analysis in JSON format.

Script:
\"\"\"
{script_text}
\"\"\"

Number of scenes planned: {scene_count}

Return ONLY a valid JSON object with this structure:
{{
  "themes": ["theme1", "theme2"],
  "tone": "descriptive tone of the content",
  "emotional_arc": "brief description of the emotional progression",
  "scenes": [
    {{
      "scene_index": 1,
      "narrative_context": "what is happening in this part of the script",
      "scene_type": "dialogue|action|establishing|transition|montage|climax",
      "suggested_media_type": "video|photo",
      "mood": "the emotional mood of this scene"
    }}
  ]
}}

Divide the script into exactly {scene_count} scenes, distributing the text roughly evenly.
Each scene should capture a distinct narrative moment or visual concept."""

    response = _call_llm(provider, prompt, model)
    parsed = _extract_json(response)

    if parsed is None:
        return {
            "raw_response": response,
            "themes": [],
            "tone": "",
            "emotional_arc": "",
            "scenes": [],
            "parse_error": "Could not extract JSON from LLM response",
        }

    return parsed


def generate_prompts(params):
    """Generate TAKE-format prompts for all scenes using LLM CLI (batch mode)."""
    provider = params.get("provider", "claude")
    model = params.get("model")
    system_prompt = params.get("system_prompt", "")
    user_message = params.get("user_message", "")

    log.info("[generate_prompts] provider=%s model=%s system_len=%d user_len=%d",
             provider, model, len(system_prompt), len(user_message))

    # Batch mode: send system prompt + user message, get all TAKES at once
    full_prompt = f"{system_prompt}\n\n---\n\n{user_message}"

    log.info("[generate_prompts] full_prompt length: %d chars", len(full_prompt))

    try:
        response = _call_llm(provider, full_prompt, model, timeout=600)
        takes = parse_takes(response)

        log.info("[generate_prompts] parse_takes returned %d takes", len(takes))
        if takes:
            log.info("[generate_prompts] first take: %s", {k: str(v)[:80] for k, v in takes[0].items()})
            log.info("[generate_prompts] last take: %s", {k: str(v)[:80] for k, v in takes[-1].items()})

        return {
            "takes": takes,
            "total": len(takes),
            "raw_response": response,
            "success": True,
        }
    except Exception as e:
        log.error("[generate_prompts] FAILED: %s", str(e), exc_info=True)
        return {
            "takes": [],
            "total": 0,
            "raw_response": "",
            "success": False,
            "error": str(e),
        }


def decide_media_types(params):
    """For 'ai-decided' mode: let the LLM decide video vs image per scene."""
    provider = params.get("provider", "claude")
    model = params.get("model")
    scenes = params.get("scenes", [])

    scene_descriptions = "\n".join(
        f"Scene {s['index']}: \"{s.get('block_texts', '')}\" "
        f"(duration: {s.get('duration_ms', 0) / 1000:.1f}s, context: {s.get('narrative_context', 'N/A')})"
        for s in scenes
    )

    prompt = f"""For each scene below, decide whether it should be a VIDEO (6-8s, dynamic, action) or PHOTO (3-5s, static, atmospheric).

Scenes:
{scene_descriptions}

Guidelines:
- Use VIDEO for: action, movement, dialogue with gestures, transitions, establishing shots
- Use PHOTO for: still moments, text overlays, atmospheric scenes, pauses, contemplative moments
- Alternate between types to create visual rhythm
- Consider the narrative flow and pacing

Return ONLY a valid JSON array:
[
  {{"scene_index": 1, "media_type": "video", "reasoning": "brief reason"}},
  {{"scene_index": 2, "media_type": "photo", "reasoning": "brief reason"}}
]"""

    response = _call_llm(provider, prompt, model)
    parsed = _extract_json(response)

    if parsed is None:
        return {
            "decisions": [],
            "raw_response": response,
            "parse_error": "Could not extract JSON from LLM response",
        }

    decisions = parsed if isinstance(parsed, list) else parsed.get("decisions", [])
    return {"decisions": decisions}


def export_prompts(params):
    """Export all scene prompts as a structured document."""
    scenes = params.get("scenes", [])
    fmt = params.get("format", "markdown")
    output_path = params.get("output_path", "")

    if fmt == "json":
        content = json.dumps(
            [
                {
                    "index": s["index"],
                    "filename_hint": s.get("filename_hint", f"scene_{s['index']:03d}"),
                    "media_type": s.get("media_type", "video"),
                    "platform": s.get("platform", "vo3"),
                    "duration_ms": s.get("duration_ms", 0),
                    "prompt": s.get("prompt", ""),
                    "narrative_context": s.get("narrative_context", ""),
                }
                for s in scenes
            ],
            indent=2,
            ensure_ascii=False,
        )
    elif fmt == "csv":
        lines = ["index,filename,media_type,platform,duration_s,prompt"]
        for s in scenes:
            prompt_escaped = s.get("prompt", "").replace('"', '""')
            idx = s["index"]
            hint = s.get("filename_hint", f"scene_{idx:03d}")
            lines.append(
                f'{idx},'
                f'{hint},'
                f'{s.get("media_type", "video")},'
                f'{s.get("platform", "vo3")},'
                f'{s.get("duration_ms", 0) / 1000:.1f},'
                f'"{prompt_escaped}"'
            )
        content = "\n".join(lines)
    else:  # markdown
        lines = [f"# Scene Prompts ({len(scenes)} scenes)\n"]
        for s in scenes:
            hint = s.get("filename_hint", f"scene_{s['index']:03d}")
            media = s.get("media_type", "video")
            platform = s.get("platform", "vo3")
            dur = s.get("duration_ms", 0) / 1000
            lines.append(f"## Scene {s['index']} ({hint})")
            lines.append(f"- **Type**: {media} | **Platform**: {platform} | **Duration**: {dur:.1f}s")
            if s.get("narrative_context"):
                lines.append(f"- **Context**: {s['narrative_context']}")
            lines.append(f"\n{s.get('prompt', '(no prompt)')}\n")
            lines.append("---\n")
        content = "\n".join(lines)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    return {
        "output_path": output_path,
        "format": fmt,
        "scene_count": len(scenes),
        "content": content if not output_path else None,
    }
