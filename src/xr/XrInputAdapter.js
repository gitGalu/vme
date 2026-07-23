// Merges the two Quest controllers (WebXR 'xr-standard' gamepads on
// session.inputSources) into ONE synthetic Gamepad with the W3C 'standard'
// mapping (KROK 4). XrSessionManager swaps it into navigator.getGamepads()
// for the session's lifetime, so BOTH consumers work unchanged:
//   - GamepadManager (in-game long-press menu, joystick bridge) - standard slots,
//   - RetroArch's own emscripten pad driver polling navigator.getGamepads().
//
// xr-standard per hand: buttons[0]=trigger [1]=squeeze [3]=stick click
// [4]=A/X [5]=B/Y; axes[2,3]=thumbstick. Layout chosen for the retropad:
// right hand = face buttons (A/B), left hand = X/Y; stick clicks act as
// Select/Start (their long-press is the exit-VR/menu gesture - see
// GamepadManager.pollIngameTrigger which watches buttons 8/9/11).
const TRIGGER = 0, SQUEEZE = 1, STICK_CLICK = 3, BTN_LOWER = 4, BTN_UPPER = 5;
// Left controller only (meta-quest-touch-plus profile, index 7): the ☰ Menu
// button. Merged into Start - its long-press is the natural in-game menu key.
const MENU = 7;
const AXIS_X = 2, AXIS_Y = 3;
const DPAD_THRESHOLD = 0.5;

function button(src, i) {
    const b = src?.gamepad?.buttons?.[i];
    return b
        ? { pressed: !!b.pressed, touched: !!b.touched, value: b.value || 0 }
        : { pressed: false, touched: false, value: 0 };
}

function axis(src, i) {
    const v = src?.gamepad?.axes?.[i];
    return typeof v === 'number' ? v : 0;
}

function digital(pressed) {
    return { pressed, touched: pressed, value: pressed ? 1 : 0 };
}

function orButton(a, b) {
    return {
        pressed: a.pressed || b.pressed,
        touched: a.touched || b.touched,
        value: Math.max(a.value, b.value)
    };
}

/**
 * Builds the merged 'standard'-mapping pad for the given XR session, or null
 * while no controller exposes a gamepad (e.g. hand tracking only).
 * Call once per XR frame; consumers read the same snapshot until the next one.
 * @param {boolean} [jumpOnButton] - retropad joystick platforms (Amiga…): route
 *   B (right upper) to d-pad UP (jump) and drop it from the face buttons so it no
 *   longer fires; A stays fire. Lets platformers jump with B instead of stick-up.
 */
export function buildSyntheticGamepad(session, index, jumpOnButton = false) {
    let left = null, right = null;
    for (const src of session.inputSources || []) {
        if (!src.gamepad) continue;
        if (src.handedness === 'left') left = src;
        else if (src.handedness === 'right') right = src;
    }
    if (!left && !right) return null;

    const lx = axis(left, AXIS_X), ly = axis(left, AXIS_Y);
    // In jump-on-button mode B feeds d-pad UP, not the B face button.
    const rawB = button(right, BTN_UPPER);
    const bAsButton = jumpOnButton ? digital(false) : rawB;
    const jumpUp = jumpOnButton && rawB.pressed;

    return {
        id: 'VM/E XR (Quest controllers)',
        index,
        connected: true,
        mapping: 'standard',
        timestamp: performance.now(),
        axes: [lx, ly, axis(right, AXIS_X), axis(right, AXIS_Y)],
        buttons: [
            button(right, BTN_LOWER),   //  0 A
            bAsButton,                  //  1 B (dropped in jump-on-button mode)
            button(left, BTN_LOWER),    //  2 X
            button(left, BTN_UPPER),    //  3 Y
            button(left, SQUEEZE),      //  4 LB
            button(right, SQUEEZE),     //  5 RB
            button(left, TRIGGER),      //  6 LT
            button(right, TRIGGER),     //  7 RT
            // 8 Select: unmapped - the sticks are spoken for (right = the VME menu
            // trigger below, left = Start). Revisit if a core needs Select badly.
            digital(false),
            // 9 Start: LEFT stick click OR the left ☰ Menu button (when the browser
            // ever delivers it). The RIGHT stick click is deliberately NOT here -
            // it's the instant in-game-menu trigger (rightStickClicked), consumed
            // by VME and never shown to the core.
            orButton(button(left, STICK_CLICK), button(left, MENU)),
            digital(false),             // 10 L3
            digital(false),             // 11 R3
            // 12-15 d-pad from the left thumbstick - the retropad d-pad is the
            // primary control in most cores (the analog axes are ALSO exposed).
            // UP also fires from B in jump-on-button mode (jump = joystick up).
            digital(ly < -DPAD_THRESHOLD || jumpUp),
            digital(ly > DPAD_THRESHOLD),
            digital(lx < -DPAD_THRESHOLD),
            digital(lx > DPAD_THRESHOLD)
        ]
    };
}

/**
 * True while the RIGHT thumbstick is clicked - short click opens the in-game
 * menu, holding it ~0.7s exits the session. (The LEFT click is navigation only.)
 */
export function rightStickClicked(session) {
    for (const src of session.inputSources || []) {
        if (src.handedness === 'right' && src.gamepad?.buttons?.[STICK_CLICK]?.pressed) return true;
    }
    return false;
}

/**
 * RAW state of the right controller's upper face button (B), read straight from
 * inputSources - bypasses the retropad filter that coalesces/disables face
 * buttons on joystick platforms (A800/C64…). Used by the 'jump on button' option
 * to map B -> joystick up while A stays fire. null session -> false.
 */
export function rightUpperButtonPressed(session) {
    for (const src of session?.inputSources || []) {
        if (src.handedness === 'right') return !!src.gamepad?.buttons?.[BTN_UPPER]?.pressed;
    }
    return false;
}

/** RAW state of the right controller's lower face button (A) - the fire button. */
export function rightLowerButtonPressed(session) {
    for (const src of session?.inputSources || []) {
        if (src.handedness === 'right') return !!src.gamepad?.buttons?.[BTN_LOWER]?.pressed;
    }
    return false;
}
