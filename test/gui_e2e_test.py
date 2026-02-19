"""
GUI E2E Test - Automates the MEU PIPELINE STUDIO app visually.
Uses pyautogui to click, type, and navigate through all pipeline stages.
"""

import pyautogui
import pygetwindow as gw
import time
import sys

# Safety: move mouse to corner to abort
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3

SAMPLE_SCRIPT = """Angie Hart knew she was making a mistake the moment she agreed, but Aracelli's voice had that desperate tone that always managed to make her give in, even when every instinct screamed to refuse. Her twin sister was leaning against her bedroom door, arms crossed and wearing that expression that mixed pleading with something darker, something Angie preferred not to name.
"Please, Angie! I'm sick, I can't go!" Aracelli practically begged, and if it weren't for the calculating gleam in her eyes identical to her own Angie might have actually believed her. "Vincent's going to be furious with me! You don't understand, he's kind of abusive sometimes, you know? If I cancel again, he's going to lose it!"
Angie felt her stomach turn at the word "abusive," because if there was one thing she couldn't stand it was the idea of someone being mistreated, and her sister knew exactly that, knew exactly which string to pull to make her dance to the music. She sighed deeply, letting the book she was reading fall onto her lap as she looked at Aracelli with a mixture of distrust and resignation that had become all too familiar over the years.
"But why me, Aracelli? Can't you just call him and cancel? Make up a better excuse?" Angie tried, knowing she was fighting a losing battle, but she needed to at least try to resist before surrendering completely.
"He doesn't accept cancellations! I've tried that before and he got furious!" Aracelli moved away from the door and walked to the bed, sitting on the edge with that theatrical drama that seemed as natural to her as breathing. "Please, sis! You'll pretend to be me just today, just this once! I owe you one, I owe you several! I promise!"
Angie bit her lower lip, feeling the weight of the decision pressing on her chest, and for a moment she considered saying no, simply getting up and leaving the room, but then Aracelli played the final card, the one that always worked. "You're my only real family, Angie. If you don't help me, who will?"
And that was it, that simple, manipulative phrase that made Angie sigh in defeat, closing her eyes for a second before asking what she already knew she would ask. "What if he tries to kiss me? I mean, he's your boyfriend, isn't he?"
"He won't do that!" Aracelli answered too quickly, with a smile that didn't reach her eyes. "Just say you have a canker sore and don't want to give it to him. Simple as that."
"Fine," Angie murmured, feeling regret already settling in her chest like cold lead. "But you owe me big time for this. What do I wear?"
That's when Aracelli pulled a dress from the bag on the floor, and Angie felt the first real alarm go off in her mind, because the dress was simply hideous, a shapeless brown thing that looked like it came from a fifth-rate thrift store."""


def find_app_window():
    """Find the MEU Pipeline Studio window."""
    windows = gw.getWindowsWithTitle('MEU Pipeline Studio')
    if not windows:
        print("[ERRO] Janela 'MEU Pipeline Studio' nao encontrada!")
        print("Janelas abertas:", [w.title for w in gw.getAllWindows() if w.title.strip()])
        return None
    win = windows[0]
    print(f"[OK] Janela encontrada: '{win.title}' ({win.width}x{win.height}) em ({win.left}, {win.top})")
    return win


def focus_window(win):
    """Bring window to front and focus it."""
    try:
        if win.isMinimized:
            win.restore()
        win.activate()
        time.sleep(0.5)
        return True
    except Exception as e:
        print(f"[AVISO] Nao consegui focar a janela: {e}")
        return False


def screenshot(name="screenshot"):
    """Take a screenshot and save it."""
    path = f"C:/Users/ander/Documents/MEU PIPELINE STUDIO/test/{name}.png"
    img = pyautogui.screenshot()
    img.save(path)
    print(f"[SCREENSHOT] Salvo: {path}")
    return path


def click_at(x, y, description=""):
    """Click at absolute coordinates with logging."""
    print(f"  [CLICK] ({x}, {y}) - {description}")
    pyautogui.click(x, y)
    time.sleep(0.8)


def click_relative(win, rx, ry, description=""):
    """Click at position relative to window."""
    x = win.left + int(win.width * rx)
    y = win.top + int(win.height * ry)
    click_at(x, y, description)


def type_text(text, interval=0.01):
    """Type text using clipboard paste (faster and supports all chars)."""
    import pyperclip
    pyperclip.copy(text)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(0.5)


def run_test():
    print("=" * 60)
    print("  MEU PIPELINE STUDIO - Teste Visual E2E")
    print("=" * 60)

    # Step 0: Find and focus the app
    print("\n--- Localizando o app ---")
    win = find_app_window()
    if not win:
        return 1

    focus_window(win)
    time.sleep(1)

    # Take initial screenshot
    screenshot("00_home_screen")
    print("[OK] HomeScreen visivel")

    # Step 1: Click on recent project or "Abrir Projeto CapCut"
    print("\n--- STAGE 1: Clicando no projeto recente ---")

    # The recent project card is approximately at center, slightly below middle
    # Based on the screenshot: the draft_content.json card is around y=65% of window
    click_relative(win, 0.5, 0.64, "Projeto recente (draft_content.json)")
    time.sleep(2)
    screenshot("01_after_project_click")

    # Now we should be in the workspace at Stage 1 - Script
    # Let's wait for the UI to load
    time.sleep(1)

    # Step 2: Enter script text in the textarea
    print("\n--- STAGE 1: Digitando roteiro ---")

    # The textarea should be in the center of the stage content area
    # Click on it first to focus
    click_relative(win, 0.5, 0.50, "Textarea do roteiro")
    time.sleep(0.5)

    # Type the sample script using clipboard
    type_text(SAMPLE_SCRIPT)
    time.sleep(1)
    screenshot("02_script_entered")

    # Click "Processar Roteiro" button (should be below the textarea)
    print("\n--- STAGE 1: Processando roteiro ---")
    click_relative(win, 0.5, 0.82, "Botao Processar Roteiro")
    time.sleep(2)
    screenshot("03_blocks_preview")

    # Click "Confirmar blocos" button
    print("\n--- STAGE 1: Confirmando blocos ---")
    time.sleep(1)
    # Scroll down if needed to find the confirm button
    click_relative(win, 0.5, 0.85, "Botao Confirmar Blocos")
    time.sleep(2)
    screenshot("04_stage1_complete")

    print("\n--- STAGE 2: Audio ---")
    time.sleep(2)
    screenshot("05_stage2_audio")

    # Stage 2 should show the draft selector or auto-load since we clicked a project
    # Take screenshot to see what's shown
    print("[INFO] Stage 2 carregado - verificando estado")
    time.sleep(1)

    print("\n" + "=" * 60)
    print("  Teste visual concluido!")
    print("  Screenshots salvos em: test/")
    print("=" * 60)
    print("\n  Verifique as imagens para validar cada etapa.")

    return 0


if __name__ == "__main__":
    print("Iniciando em 3 segundos... (mova o mouse pro canto para abortar)")
    time.sleep(3)
    sys.exit(run_test())
