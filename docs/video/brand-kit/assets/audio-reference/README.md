# Audio reference (no files)

The game ships NO audio files. All sound is synthesised live with the Web Audio API
(`src/audio/`). UI sound ids you can mimic or re-synthesise for the video:
`ui.click ui.hover ui.confirm ui.back ui.error ui.open ui.close ui.choice.select ui.choice.confirm ui.stagebanner`.
Direction: `docs/audio-direction.md` (calm, felt low end, sensor sonification, dry bright UI blips).
Music: ambient bed per stage, root falls A3 -> B1 as the player grows; nothing melodic/looping to license.
To get real audio for the edit, screen-record the game with sound or render offline from `src/audio/demo.html`.
