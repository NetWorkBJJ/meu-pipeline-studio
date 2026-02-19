"""
E2E Pipeline Test - Tests all 6 stages of the MEU PIPELINE STUDIO pipeline.

Creates a mock CapCut draft, exercises every Python module, and validates
the full pipeline from script splitting to final CapCut insertion.
"""

import json
import os
import sys
import tempfile
import shutil
import re
from pathlib import Path

# Add python/ to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))

# ============================================================
# STAGE 1: Script Splitting (replicate TypeScript logic in Python)
# ============================================================

CHARS_PER_SECOND = 15
MAX_BLOCK_CHARS = 80
MIN_BLOCK_DURATION_MS = 500

def split_long_sentence(sentence: str) -> list:
    """Split a sentence that exceeds MAX_BLOCK_CHARS on commas, then words."""
    if len(sentence) <= MAX_BLOCK_CHARS:
        return [sentence]

    chunks = []
    clauses = re.split(r',\s*', sentence)
    current = ''

    for clause in clauses:
        if len(clause) > MAX_BLOCK_CHARS:
            if current:
                chunks.append(current)
                current = ''
            words = clause.split()
            word_chunk = ''
            for word in words:
                combined = (word_chunk + ' ' + word) if word_chunk else word
                if word_chunk and len(combined) > MAX_BLOCK_CHARS:
                    chunks.append(word_chunk)
                    word_chunk = word
                else:
                    word_chunk = combined
            if word_chunk:
                current = word_chunk
        elif current and len(current + ', ' + clause) > MAX_BLOCK_CHARS:
            chunks.append(current)
            current = clause
        else:
            current = (current + ', ' + clause) if current else clause

    if current:
        chunks.append(current)
    return chunks


def split_script_into_blocks(raw_script: str) -> list:
    """Replicate the TypeScript scriptSplitter logic for testing."""
    cleaned = raw_script.strip().replace('\r\n', '\n')
    if not cleaned:
        return []

    # Split on sentence boundaries (after .!?)
    sentences = re.split(r'(?<=[.!?])\s+', cleaned)
    blocks = []
    current_text = ''

    for sentence in sentences:
        trimmed = sentence.strip()
        if not trimmed:
            continue

        sentence_chunks = split_long_sentence(trimmed)

        for chunk in sentence_chunks:
            combined = (current_text + ' ' + chunk) if current_text else chunk
            if current_text and len(combined) > MAX_BLOCK_CHARS:
                blocks.append(current_text)
                current_text = chunk
            else:
                current_text = combined

    if current_text:
        blocks.append(current_text)

    # Recalculate timings
    result = []
    current_ms = 0
    for i, text in enumerate(blocks):
        char_count = len(text)
        duration_ms = max(MIN_BLOCK_DURATION_MS, round((char_count / CHARS_PER_SECOND) * 1000))
        start_ms = current_ms
        end_ms = current_ms + duration_ms
        current_ms = end_ms
        result.append({
            'id': f'block-{i+1}',
            'index': i + 1,
            'text': text,
            'startMs': start_ms,
            'endMs': end_ms,
            'durationMs': duration_ms,
            'characterCount': char_count,
            'linkedAudioId': None,
        })

    return result


# ============================================================
# STAGE 3: Sync Engine (replicate TypeScript logic)
# ============================================================

def auto_sync_blocks(story_blocks: list, audio_blocks: list) -> dict:
    """Replicate the TypeScript syncEngine logic for testing."""
    sorted_story = sorted(story_blocks, key=lambda b: b['index'])
    sorted_audio = sorted(audio_blocks, key=lambda b: b['start_ms'])

    linked_count = 0
    synced = []
    for i, block in enumerate(sorted_story):
        if i < len(sorted_audio):
            audio = sorted_audio[i]
            linked_count += 1
            synced.append({
                **block,
                'startMs': audio['start_ms'],
                'endMs': audio['end_ms'],
                'durationMs': audio['duration_ms'],
                'linkedAudioId': audio['id'],
            })
        else:
            synced.append({**block, 'linkedAudioId': None})

    return {
        'syncedBlocks': synced,
        'linkedCount': linked_count,
        'unlinkedCount': len(sorted_story) - linked_count,
    }


# ============================================================
# STAGE 4: Scene Grouper (replicate TypeScript logic)
# ============================================================

def auto_group_scenes(blocks: list, blocks_per_scene: int = 3) -> list:
    """Replicate the TypeScript sceneGrouper logic for testing."""
    if not blocks:
        return []

    sorted_blocks = sorted(blocks, key=lambda b: b['index'])
    scenes = []

    for i in range(0, len(sorted_blocks), blocks_per_scene):
        group = sorted_blocks[i:i + blocks_per_scene]
        first = group[0]
        last = group[-1]
        description = ' '.join(b['text'] for b in group)[:100]

        scenes.append({
            'id': f'scene-{len(scenes) + 1}',
            'index': len(scenes) + 1,
            'description': description,
            'startMs': first['startMs'],
            'endMs': last['endMs'],
            'durationMs': last['endMs'] - first['startMs'],
            'mediaKeyword': '',
            'mediaType': 'video',
            'mediaPath': None,
            'blockIds': [b['id'] for b in group],
        })

    return scenes


# ============================================================
# Mock CapCut draft_content.json
# ============================================================

def create_mock_capcut_draft(draft_path: str, audio_blocks: list):
    """Create a realistic CapCut draft_content.json with audio tracks."""
    audio_segments = []
    audio_materials = []

    for i, block in enumerate(audio_blocks):
        mat_id = f"audio-mat-{i+1}"
        seg_id = f"audio-seg-{i+1}"
        start_us = int(block['startMs'] * 1000)
        dur_us = int(block['durationMs'] * 1000)

        audio_materials.append({
            "id": mat_id,
            "path": f"##tts_audio_{i+1}.mp3",
            "duration": dur_us,
            "tone_type": "BV700_streaming",
            "tone_platform": "volcengine",
            "type": "extract_music",
        })

        audio_segments.append({
            "id": seg_id,
            "material_id": mat_id,
            "target_timerange": {
                "start": start_us,
                "duration": dur_us,
            },
            "source_timerange": {
                "start": 0,
                "duration": dur_us,
            },
            "visible": True,
            "volume": 1.0,
        })

    total_duration_us = 0
    if audio_blocks:
        last = audio_blocks[-1]
        total_duration_us = int((last['startMs'] + last['durationMs']) * 1000)

    draft = {
        "canvas_config": {
            "width": 1080,
            "height": 1920,
            "ratio": "9:16",
        },
        "duration": total_duration_us,
        "tracks": [
            {
                "id": "track-audio-1",
                "type": "audio",
                "segments": audio_segments,
                "flag": 0,
                "attribute": 0,
            }
        ],
        "materials": {
            "audios": audio_materials,
            "videos": [],
            "texts": [],
            "speeds": [],
            "canvases": [],
            "material_colors": [],
            "sound_channel_mappings": [],
        },
    }

    with open(draft_path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False, indent=2)

    return draft


def create_mock_meta_files(draft_dir: str, draft_id: str):
    """Create mock draft_meta_info.json and root_meta_info.json."""
    draft_meta = {
        "draft_id": draft_id,
        "draft_name": "Test Draft",
        "draft_timeline_materials_size_": 0,
    }
    with open(os.path.join(draft_dir, "draft_meta_info.json"), "w") as f:
        json.dump(draft_meta, f)

    root_dir = Path(draft_dir).parent.parent
    root_dir.mkdir(parents=True, exist_ok=True)
    root_meta = {
        "all_draft_store": [
            {
                "draft_id": draft_id,
                "draft_name": "Test Draft",
                "draft_timeline_materials_size": 0,
            }
        ]
    }
    with open(root_dir / "root_meta_info.json", "w") as f:
        json.dump(root_meta, f)


# ============================================================
# Test Runner
# ============================================================

PASS = 0
FAIL = 0

def test(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} - {detail}")


def run_tests():
    global PASS, FAIL

    # Sample script (truncated from the provided text)
    SAMPLE_SCRIPT = """Angie Hart knew she was making a mistake the moment she agreed, but Aracelli's voice had that desperate tone that always managed to make her give in, even when every instinct screamed to refuse. Her twin sister was leaning against her bedroom door, arms crossed and wearing that expression that mixed pleading with something darker, something Angie preferred not to name.
"Please, Angie! I'm sick, I can't go!" Aracelli practically begged, and if it weren't for the calculating gleam in her eyes identical to her own Angie might have actually believed her. "Vincent's going to be furious with me! You don't understand, he's kind of... abusive sometimes, you know? If I cancel again, he's going to lose it!"
Angie felt her stomach turn at the word "abusive," because if there was one thing she couldn't stand it was the idea of someone being mistreated, and her sister knew exactly that, knew exactly which string to pull to make her dance to the music. She sighed deeply, letting the book she was reading fall onto her lap as she looked at Aracelli with a mixture of distrust and resignation that had become all too familiar over the years.
"But why me, Aracelli? Can't you just call him and cancel? Make up a better excuse?" Angie tried, knowing she was fighting a losing battle, but she needed to at least try to resist before surrendering completely.
"He doesn't accept cancellations! I've tried that before and he got furious!" Aracelli moved away from the door and walked to the bed, sitting on the edge with that theatrical drama that seemed as natural to her as breathing. "Please, sis! You'll pretend to be me just today, just this once! I owe you one, I owe you several! I promise!"
Angie bit her lower lip, feeling the weight of the decision pressing on her chest, and for a moment she considered saying no, simply getting up and leaving the room, but then Aracelli played the final card, the one that always worked. "You're my only real family, Angie. If you don't help me, who will?"
And that was it, that simple, manipulative phrase that made Angie sigh in defeat, closing her eyes for a second before asking what she already knew she would ask. "What if he tries to kiss me? I mean, he's your boyfriend, isn't he?"
"He won't do that!" Aracelli answered too quickly, with a smile that didn't reach her eyes. "Just say you have a canker sore and don't want to give it to him. Simple as that."
"Fine," Angie murmured, feeling regret already settling in her chest like cold lead. "But you owe me big time for this. What do I wear?"
That's when Aracelli pulled a dress from the bag on the floor, and Angie felt the first real alarm go off in her mind, because the dress was simply hideous, a shapeless brown thing that looked like it came from a fifth-rate thrift store. She picked up the fabric between her fingers with barely disguised disgust, frowning as she looked at her sister for an explanation.
"This? Seriously? This doesn't look anything like your style, Aracelli." Angie held the dress up to eye level, turning it from side to side as if hoping a different angle would make it less ugly.
"It's a test!" Aracelli responded with that rehearsed quickness that gave away the lie. "I want to see if he really wants me without all the glamour, you know? No makeup, simple hair, basic outfit. To find out if it's real love or just physical attraction."
Angie knew she was being deceived, felt it in the way her stomach churned and how her intuition screamed danger, but at the same time she couldn't imagine exactly what the plan behind all this was, so she ended up nodding, still holding the ugly dress with disgust. "Where's the date?"
"Le Blanc restaurant, eight at night," Aracelli stood up quickly, as if afraid Angie would change her mind. "And Angie? Be yourself. Shy, quiet, vulnerable. He'll understand, he'll like that. Trust me."
But Angie didn't trust her, and as Aracelli left the room with a victorious smile on her lips, she stood there holding that horrible dress and wondering what exactly she had gotten herself into this time.
The Le Blanc restaurant was the kind of place Angie would never frequent on her own, all elegant and full of people who seemed to have been born knowing which fork to use for each course, and she felt completely out of place the moment she walked in wearing that shapeless brown dress and with her hair simply pulled back in a basic ponytail. The looks she received didn't help at all, especially from the impeccably dressed women who analyzed her from head to toe with that kind of silent judgment that hurts more than words.
She spotted Vincent Ballard immediately, because it was impossible not to spot him, sitting at a corner table in a suit that probably cost more than her three months' rent, all composed and with that neutral expression that could easily be mistaken for boredom or disinterest. He was reading the menu when she approached, and for a second Angie considered turning around and running out of there, but it was already too late, he had already looked up and seen her.
"Vincent?" Her voice came out lower and shyer than intended, and she saw the immediate confusion on his face, that almost imperceptible furrowing of his brow that indicated something wasn't adding up.
"Aracelli?" He responded, but there was a clear question in his tone, as if he wasn't sure he was really talking to the right person. His dark eyes traveled over her face, down the horrible dress, back to her simple hair, and she could see the calculations happening behind that penetrating gaze.
"Yes, hi. Sorry I'm late." Angie sat down quickly, before her legs decided that running away was the best option, and immediately avoided his gaze, focusing on the menu as if it were the most fascinating thing she'd ever seen in her life.
"You look different," Vincent said after a moment, and it wasn't a question, it was an observation, a cold and direct statement that made Angie swallow hard. "Hair? Clothes? What changed?"
"Wanted to change things up a bit," she murmured, still not looking at him directly, feeling the heat rise up her neck and knowing she was probably turning red. "Test something new."
Vincent was silent for a moment that seemed to stretch for hours, and when Angie finally gathered the courage to look at him, she found those dark eyes still studying every detail of her face with an intensity that made her heart race. There was something in that gaze that left her breathless, something dangerous and fascinating at the same time, and she had to force herself to look away again.
"Wine?" He offered, already signaling to the waiter, but Angie answered before she could censor herself.
"Water, please. I don't drink much."
The silence that followed was heavy, and she didn't need to look to know he was even more confused, probably going over all the times Aracelli had drunk wine in front of him, because from his reaction, there must have been many.
"Since when?" The question came loaded with suspicion, and Angie felt panic rise up her throat.
"Since today," she improvised quickly, risking a glance at him and forcing a small smile. "I'm trying to be healthier."
Vincent didn't seem convinced, but nodded and ordered water for her, and Angie took advantage of the moment of his distraction with the waiter to try to control her breathing and calm the heart that was beating erratically in her chest. She wasn't good at lying, never had been, and every second at that table was making her entire body scream in protest."""

    print("=" * 70)
    print("MEU PIPELINE STUDIO - E2E Pipeline Test")
    print("=" * 70)

    # ============================================================
    # STAGE 1: Script Splitting
    # ============================================================
    print("\n--- STAGE 1: Script Splitting ---")

    blocks = split_script_into_blocks(SAMPLE_SCRIPT)

    test("Script produces blocks", len(blocks) > 0, f"Got {len(blocks)} blocks")
    test("All blocks have text", all(b['text'] for b in blocks))
    test("No block exceeds MAX_BLOCK_CHARS", all(len(b['text']) <= MAX_BLOCK_CHARS for b in blocks),
         f"Max found: {max(len(b['text']) for b in blocks) if blocks else 0}")
    test("Timings are sequential", all(blocks[i]['endMs'] == blocks[i+1]['startMs'] for i in range(len(blocks)-1)))
    test("All durations >= MIN_BLOCK_DURATION_MS",
         all(b['durationMs'] >= MIN_BLOCK_DURATION_MS for b in blocks))
    test("Indices start at 1", blocks[0]['index'] == 1 if blocks else False)
    test("Indices are sequential", all(blocks[i]['index'] == i+1 for i in range(len(blocks))))

    total_duration_ms = blocks[-1]['endMs'] if blocks else 0
    print(f"\n  Stats: {len(blocks)} blocks, total duration: {total_duration_ms}ms ({total_duration_ms/1000:.1f}s)")
    print(f"  First block: \"{blocks[0]['text'][:60]}...\"" if blocks else "  No blocks")
    print(f"  Last block: \"{blocks[-1]['text'][:60]}...\"" if blocks else "")

    # ============================================================
    # STAGE 2: Audio Block Reading (Python bridge)
    # ============================================================
    print("\n--- STAGE 2: Audio Block Reading ---")

    # Create mock audio blocks that match the story blocks
    mock_audio_blocks_for_draft = []
    current_ms = 0
    for i, block in enumerate(blocks):
        # Simulate TTS audio with slightly different timing (realistic)
        audio_duration = block['durationMs'] + (i % 3) * 100  # small variation
        mock_audio_blocks_for_draft.append({
            'startMs': current_ms,
            'endMs': current_ms + audio_duration,
            'durationMs': audio_duration,
        })
        current_ms += audio_duration

    # Create temp directory structure: com.lveditor.draft/test-draft-123/
    temp_root = tempfile.mkdtemp(prefix="meu-pipeline-test-")
    draft_parent = os.path.join(temp_root, "com.lveditor.draft", "test-draft-123")
    os.makedirs(draft_parent, exist_ok=True)
    draft_path = os.path.join(draft_parent, "draft_content.json")

    try:
        # Create mock draft with audio
        create_mock_capcut_draft(draft_path, mock_audio_blocks_for_draft)
        create_mock_meta_files(draft_parent, "test-draft-123")

        test("Mock draft created", os.path.exists(draft_path))

        # Test capcut_reader
        from capcut_reader import read_draft, read_audio_blocks

        draft_info = read_draft(draft_path)
        test("read_draft returns canvas_config", "canvas_config" in draft_info)
        test("Canvas is 9:16 (1080x1920)", draft_info["canvas_config"]["width"] == 1080 and draft_info["canvas_config"]["height"] == 1920)
        test("read_draft has audio_materials", len(draft_info["audio_materials"]) == len(blocks),
             f"Expected {len(blocks)}, got {len(draft_info['audio_materials'])}")
        test("read_draft has 1 audio track", len([t for t in draft_info["tracks"] if t["type"] == "audio"]) == 1)

        audio_blocks_from_draft = read_audio_blocks(draft_path)
        test("read_audio_blocks returns correct count", len(audio_blocks_from_draft) == len(blocks),
             f"Expected {len(blocks)}, got {len(audio_blocks_from_draft)}")
        test("Audio blocks have start_ms", all("start_ms" in b for b in audio_blocks_from_draft))
        test("Audio blocks have end_ms", all("end_ms" in b for b in audio_blocks_from_draft))
        test("Audio blocks have duration_ms", all("duration_ms" in b for b in audio_blocks_from_draft))
        test("Audio blocks are sorted by start_ms",
             all(audio_blocks_from_draft[i]["start_ms"] <= audio_blocks_from_draft[i+1]["start_ms"]
                 for i in range(len(audio_blocks_from_draft)-1)))
        test("Audio blocks have material_id", all(b["material_id"] for b in audio_blocks_from_draft))

        print(f"\n  Stats: {len(audio_blocks_from_draft)} audio blocks read from mock draft")
        if audio_blocks_from_draft:
            last_audio = audio_blocks_from_draft[-1]
            print(f"  Total audio duration: {last_audio['end_ms']:.0f}ms ({last_audio['end_ms']/1000:.1f}s)")

        # ============================================================
        # STAGE 3: Sync Engine
        # ============================================================
        print("\n--- STAGE 3: Sync Engine ---")

        # Convert read audio blocks to format expected by syncEngine
        audio_for_sync = [{
            'id': b['id'],
            'start_ms': b['start_ms'],
            'end_ms': b['end_ms'],
            'duration_ms': b['duration_ms'],
        } for b in audio_blocks_from_draft]

        sync_result = auto_sync_blocks(blocks, audio_for_sync)
        synced_blocks = sync_result['syncedBlocks']

        test("Sync produces same block count", len(synced_blocks) == len(blocks))
        test("All blocks linked", sync_result['linkedCount'] == len(blocks),
             f"Linked: {sync_result['linkedCount']}, Expected: {len(blocks)}")
        test("Zero unlinked", sync_result['unlinkedCount'] == 0,
             f"Unlinked: {sync_result['unlinkedCount']}")
        test("Synced blocks have linkedAudioId", all(b['linkedAudioId'] for b in synced_blocks))
        test("Synced timings match audio", all(
            synced_blocks[i]['startMs'] == audio_for_sync[i]['start_ms'] and
            synced_blocks[i]['endMs'] == audio_for_sync[i]['end_ms']
            for i in range(len(synced_blocks))
        ))
        test("Text preserved after sync", all(
            synced_blocks[i]['text'] == blocks[i]['text']
            for i in range(len(synced_blocks))
        ))

        print(f"\n  Stats: {sync_result['linkedCount']} linked, {sync_result['unlinkedCount']} unlinked")

        # ============================================================
        # Test update_subtitle_timings (Stage 3 continued)
        # ============================================================
        print("\n--- STAGE 3b: Write Text + Update Subtitle Timings ---")

        from capcut_writer import write_text_segments, update_subtitle_timings, write_video_segments

        # First, write text segments (will be needed for Stage 6 test too)
        text_blocks_for_write = [{
            'text': b['text'],
            'start_ms': b['startMs'],
            'end_ms': b['endMs'],
        } for b in synced_blocks]

        write_result = write_text_segments(draft_path, text_blocks_for_write)
        test("write_text_segments returns added_count", write_result["added_count"] == len(blocks),
             f"Expected {len(blocks)}, got {write_result['added_count']}")
        test("write_text_segments returns segment details",
             len(write_result["segments"]) == len(blocks))
        test("Each segment has material_id",
             all(s["material_id"] for s in write_result["segments"]))

        # Verify draft was updated
        with open(draft_path, "r") as f:
            draft_after_text = json.load(f)

        text_tracks = [t for t in draft_after_text.get("tracks", []) if t.get("type") == "text"]
        test("Text track created", len(text_tracks) == 1)
        if text_tracks:
            text_segs = text_tracks[0].get("segments", [])
            test("Text segments count matches", len(text_segs) == len(blocks),
                 f"Expected {len(blocks)}, got {len(text_segs)}")

        text_mats = draft_after_text.get("materials", {}).get("texts", [])
        test("Text materials created", len(text_mats) == len(blocks),
             f"Expected {len(blocks)}, got {len(text_mats)}")

        # Now test update_subtitle_timings with the CORRECT material_ids
        # (Use text material IDs, not audio IDs - this is the known bug fix)
        timing_updates = [{
            'material_id': seg['material_id'],
            'start_ms': synced_blocks[i]['startMs'] + 50,  # slight adjustment
            'end_ms': synced_blocks[i]['endMs'] + 50,
        } for i, seg in enumerate(write_result['segments'])]

        update_result = update_subtitle_timings(draft_path, timing_updates)
        test("update_subtitle_timings updates all", update_result["updated_count"] == len(blocks),
             f"Expected {len(blocks)}, got {update_result['updated_count']}")

        # Verify timings were updated in the draft
        with open(draft_path, "r") as f:
            draft_after_update = json.load(f)
        text_track_updated = [t for t in draft_after_update["tracks"] if t["type"] == "text"][0]
        first_seg = text_track_updated["segments"][0]
        expected_start_us = int(timing_updates[0]['start_ms'] * 1000)
        test("Timing updated in draft",
             first_seg["target_timerange"]["start"] == expected_start_us,
             f"Expected {expected_start_us}, got {first_seg['target_timerange']['start']}")

        # Test known bug: what happens when passing audio IDs instead of text material IDs
        print("\n  [BUG CHECK] Testing known bug #1: audio IDs passed to update_subtitle_timings")
        wrong_timing_updates = [{
            'material_id': audio_blocks_from_draft[i]['material_id'],  # WRONG: audio IDs
            'start_ms': synced_blocks[i]['startMs'],
            'end_ms': synced_blocks[i]['endMs'],
        } for i in range(min(len(audio_blocks_from_draft), len(synced_blocks)))]

        wrong_result = update_subtitle_timings(draft_path, wrong_timing_updates)
        test("[BUG CONFIRMED] Audio IDs update 0 text segments",
             wrong_result["updated_count"] == 0,
             f"Updated {wrong_result['updated_count']} (should be 0 since audio IDs dont match text segments)")

        print(f"\n  Stats: {write_result['added_count']} text segments written, {update_result['updated_count']} timings updated")

        # ============================================================
        # STAGE 4: Scene Grouper
        # ============================================================
        print("\n--- STAGE 4: Scene Grouper ---")

        scenes = auto_group_scenes(synced_blocks, blocks_per_scene=3)

        import math
        expected_scenes = math.ceil(len(synced_blocks) / 3)
        test("Scene count correct", len(scenes) == expected_scenes,
             f"Expected {expected_scenes}, got {len(scenes)}")
        test("All scenes have blockIds", all(len(s['blockIds']) > 0 for s in scenes))
        test("Max 3 blocks per scene", all(len(s['blockIds']) <= 3 for s in scenes))
        test("Scenes have sequential indices", all(scenes[i]['index'] == i+1 for i in range(len(scenes))))
        test("Scenes cover all blocks",
             sum(len(s['blockIds']) for s in scenes) == len(synced_blocks))
        test("Scenes have valid timing",
             all(s['endMs'] > s['startMs'] for s in scenes))
        test("Scenes are contiguous",
             all(scenes[i]['endMs'] <= scenes[i+1]['startMs'] or
                 scenes[i]['endMs'] == scenes[i+1]['startMs']
                 for i in range(len(scenes)-1)))
        test("Default mediaType is video", all(s['mediaType'] == 'video' for s in scenes))
        test("mediaPath starts as None", all(s['mediaPath'] is None for s in scenes))

        print(f"\n  Stats: {len(scenes)} scenes from {len(synced_blocks)} blocks (3 blocks/scene)")

        # ============================================================
        # STAGE 5: Media Assignment (simulate)
        # ============================================================
        print("\n--- STAGE 5: Media Assignment (simulated) ---")

        # Create some fake media files
        media_dir = os.path.join(temp_root, "media")
        os.makedirs(media_dir, exist_ok=True)

        for i, scene in enumerate(scenes):
            fake_media = os.path.join(media_dir, f"scene_{i+1}.mp4")
            with open(fake_media, "w") as f:
                f.write("fake video data " * 100)  # ~1.5KB fake file
            scene['mediaPath'] = fake_media
            if i % 3 == 0:
                scene['mediaType'] = 'photo'
                # rename to .jpg
                fake_photo = fake_media.replace('.mp4', '.jpg')
                os.rename(fake_media, fake_photo)
                scene['mediaPath'] = fake_photo

        test("All scenes have media assigned", all(s['mediaPath'] for s in scenes))
        test("Media files exist", all(os.path.exists(s['mediaPath']) for s in scenes))

        video_count = sum(1 for s in scenes if s['mediaType'] == 'video')
        photo_count = sum(1 for s in scenes if s['mediaType'] == 'photo')
        print(f"\n  Stats: {video_count} videos, {photo_count} photos assigned")

        # ============================================================
        # STAGE 6: Insert into CapCut
        # ============================================================
        print("\n--- STAGE 6: Insert into CapCut ---")

        # Write video segments
        video_scenes_for_write = [{
            'media_path': s['mediaPath'],
            'start_ms': s['startMs'],
            'end_ms': s['endMs'],
            'media_type': s['mediaType'],
        } for s in scenes if s['mediaPath']]

        video_result = write_video_segments(draft_path, video_scenes_for_write)
        test("write_video_segments returns correct count",
             video_result["added_count"] == len(scenes),
             f"Expected {len(scenes)}, got {video_result['added_count']}")
        test("Video segments have material_ids",
             all(s["material_id"] for s in video_result["segments"]))

        # Verify draft has both text and video tracks now
        with open(draft_path, "r") as f:
            final_draft = json.load(f)

        track_types = [t.get("type") for t in final_draft.get("tracks", [])]
        test("Draft has audio track", "audio" in track_types)
        test("Draft has text track", "text" in track_types)
        test("Draft has video track", "video" in track_types)

        video_tracks = [t for t in final_draft["tracks"] if t["type"] == "video"]
        if video_tracks:
            video_segs = video_tracks[0].get("segments", [])
            test("Video segments count matches scenes", len(video_segs) == len(scenes),
                 f"Expected {len(scenes)}, got {len(video_segs)}")

        # Verify materials
        final_materials = final_draft.get("materials", {})
        test("Video materials added", len(final_materials.get("videos", [])) == len(scenes),
             f"Expected {len(scenes)}, got {len(final_materials.get('videos', []))}")
        test("Text materials preserved", len(final_materials.get("texts", [])) == len(blocks),
             f"Expected {len(blocks)}, got {len(final_materials.get('texts', []))}")
        test("Audio materials preserved", len(final_materials.get("audios", [])) == len(blocks),
             f"Expected {len(blocks)}, got {len(final_materials.get('audios', []))}")
        test("Speed materials created (text + video)",
             len(final_materials.get("speeds", [])) >= len(blocks) + len(scenes))

        # Test known bug: duplicate insertion
        print("\n  [BUG CHECK] Testing known bug #2: duplicate insertion")
        video_result_2 = write_video_segments(draft_path, video_scenes_for_write)
        with open(draft_path, "r") as f:
            draft_after_dup = json.load(f)
        video_tracks_dup = [t for t in draft_after_dup["tracks"] if t["type"] == "video"]
        dup_seg_count = len(video_tracks_dup[0]["segments"]) if video_tracks_dup else 0
        test("[BUG CONFIRMED] Duplicate video segments allowed",
             dup_seg_count == len(scenes) * 2,
             f"After 2x insert: {dup_seg_count} segments (expected {len(scenes)*2})")

        # ============================================================
        # Metadata Sync
        # ============================================================
        print("\n--- Metadata Sync ---")

        from metadata_sync import sync_metadata

        sync_result_meta = sync_metadata(draft_parent)
        test("sync_metadata returns synced=True", sync_result_meta["synced"])
        test("sync_metadata returns materials_size", "materials_size" in sync_result_meta)

        # Check meta files were updated
        with open(os.path.join(draft_parent, "draft_meta_info.json"), "r") as f:
            meta_after = json.load(f)
        test("draft_meta_info has trailing underscore field",
             "draft_timeline_materials_size_" in meta_after)

        root_meta_path = Path(draft_parent).parent.parent / "root_meta_info.json"
        if root_meta_path.exists():
            with open(root_meta_path, "r") as f:
                root_after = json.load(f)
            test("root_meta_info updated",
                 root_after["all_draft_store"][0]["draft_timeline_materials_size"] >= 0)

        # ============================================================
        # SRT Generation
        # ============================================================
        print("\n--- SRT Generation ---")

        from srt_generator import generate_srt

        srt_blocks = [{
            'index': b['index'],
            'text': b['text'],
            'start_ms': b['startMs'],
            'end_ms': b['endMs'],
        } for b in synced_blocks]

        srt_path = os.path.join(temp_root, "output.srt")
        srt_result = generate_srt(srt_blocks, srt_path)
        test("SRT file created", os.path.exists(srt_path))
        test("SRT block_count matches", srt_result["block_count"] == len(blocks),
             f"Expected {len(blocks)}, got {srt_result['block_count']}")

        with open(srt_path, "r", encoding="utf-8") as f:
            srt_content = f.read()
        test("SRT has content", len(srt_content) > 0)
        test("SRT has correct format (-->)", "-->" in srt_content)
        test("SRT starts with index 1", srt_content.strip().startswith("1"))

        # Count SRT entries
        srt_entries = [p for p in srt_content.strip().split('\n\n') if p.strip()]
        test("SRT entry count matches blocks", len(srt_entries) == len(blocks),
             f"Expected {len(blocks)}, got {len(srt_entries)}")

        print(f"\n  SRT file: {srt_path}")
        print(f"  SRT size: {len(srt_content)} bytes")
        # Show first 3 SRT entries
        for entry in srt_entries[:3]:
            for line in entry.strip().split('\n'):
                print(f"    {line}")
            print()

        # ============================================================
        # Python Bridge Protocol Test
        # ============================================================
        print("\n--- Python Bridge Protocol ---")

        import subprocess

        bridge_path = os.path.join(os.path.dirname(__file__), '..', 'python', 'main_bridge.py')

        # Test 1: read_audio_blocks via bridge
        request = json.dumps({
            "id": "test-1",
            "method": "read_audio_blocks",
            "params": {"draft_path": draft_path}
        }) + "\n"

        proc = subprocess.run(
            [sys.executable, bridge_path],
            input=request,
            capture_output=True,
            text=True,
            timeout=10,
        )

        test("Bridge process exits cleanly", proc.returncode == 0,
             f"Return code: {proc.returncode}, stderr: {proc.stderr[:200]}")

        if proc.stdout.strip():
            response = json.loads(proc.stdout.strip().split('\n')[0])
            test("Bridge response has id", response.get("id") == "test-1")
            test("Bridge response has result", "result" in response)
            if "result" in response:
                test("Bridge returns audio blocks",
                     isinstance(response["result"], list) and len(response["result"]) > 0)

        # Test 2: Multiple requests in one session
        requests = ""
        requests += json.dumps({"id": "req-1", "method": "read_draft", "params": {"draft_path": draft_path}}) + "\n"
        requests += json.dumps({"id": "req-2", "method": "read_audio_blocks", "params": {"draft_path": draft_path}}) + "\n"
        requests += json.dumps({"id": "req-3", "method": "unknown_method", "params": {}}) + "\n"

        proc2 = subprocess.run(
            [sys.executable, bridge_path],
            input=requests,
            capture_output=True,
            text=True,
            timeout=10,
        )

        responses = [json.loads(line) for line in proc2.stdout.strip().split('\n') if line.strip()]
        test("Bridge handles multiple requests", len(responses) == 3,
             f"Expected 3 responses, got {len(responses)}")
        if len(responses) >= 3:
            test("First response is success", "result" in responses[0])
            test("Second response is success", "result" in responses[1])
            test("Third response is error (unknown method)", "error" in responses[2])
            if "error" in responses[2]:
                test("Error message mentions unknown method",
                     "unknown_method" in responses[2]["error"]["message"].lower())

        # Test 3: Invalid JSON handling
        proc3 = subprocess.run(
            [sys.executable, bridge_path],
            input="not-json\n" + json.dumps({"id": "after-invalid", "method": "read_draft", "params": {"draft_path": draft_path}}) + "\n",
            capture_output=True,
            text=True,
            timeout=10,
        )
        responses3 = [json.loads(line) for line in proc3.stdout.strip().split('\n') if line.strip()]
        test("Bridge recovers from invalid JSON", len(responses3) >= 1,
             f"Got {len(responses3)} responses after invalid JSON")
        if responses3:
            test("Response after invalid JSON is valid",
                 responses3[0].get("id") == "after-invalid")

        # ============================================================
        # Final Validation
        # ============================================================
        print("\n--- Final Draft Validation ---")

        # Re-read the draft (without the duplicate insertion)
        # Reload from before the dup test
        create_mock_capcut_draft(draft_path, mock_audio_blocks_for_draft)
        write_text_segments(draft_path, text_blocks_for_write)
        write_video_segments(draft_path, video_scenes_for_write)

        with open(draft_path, "r") as f:
            clean_final = json.load(f)

        test("Final draft is valid JSON", isinstance(clean_final, dict))
        test("Final draft has tracks", len(clean_final.get("tracks", [])) >= 3)
        test("Final draft has materials", "materials" in clean_final)
        test("Final draft has canvas_config", "canvas_config" in clean_final)
        test("Final draft has duration", clean_final.get("duration", 0) > 0)

        # Verify all track types
        final_track_types = sorted([t["type"] for t in clean_final["tracks"]])
        test("All 3 track types present", final_track_types == ["audio", "text", "video"],
             f"Got: {final_track_types}")

        # Count all segments
        total_segments = sum(len(t.get("segments", [])) for t in clean_final["tracks"])
        expected_total = len(blocks) * 2 + len(scenes)  # audio + text + video
        test(f"Total segments: {total_segments}",
             total_segments == expected_total,
             f"Expected {expected_total} (audio:{len(blocks)} + text:{len(blocks)} + video:{len(scenes)})")

        print(f"\n  Final draft stats:")
        for track in clean_final["tracks"]:
            print(f"    Track '{track['type']}': {len(track.get('segments', []))} segments")
        print(f"    Materials: {len(clean_final['materials'].get('texts', []))} texts, "
              f"{len(clean_final['materials'].get('audios', []))} audios, "
              f"{len(clean_final['materials'].get('videos', []))} videos")

    finally:
        # Cleanup
        shutil.rmtree(temp_root, ignore_errors=True)

    # ============================================================
    # Summary
    # ============================================================
    print("\n" + "=" * 70)
    print(f"RESULTS: {PASS} passed, {FAIL} failed, {PASS + FAIL} total")
    print("=" * 70)

    if FAIL > 0:
        print("\nFailed tests need attention!")
        return 1
    else:
        print("\nAll tests passed! Pipeline is functional end-to-end.")
        return 0


if __name__ == "__main__":
    sys.exit(run_tests())
