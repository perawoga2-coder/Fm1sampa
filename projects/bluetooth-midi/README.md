# Project: Burger Studio BT (Bluetooth MIDI) — on hold

Status: **on hold** (2026-11-21). Research only; no firmware code was changed.

## The idea

The M-VAVE FM-1 has the same wireless MIDI as M-VAVE's own wireless MIDI DIN adapters, and it does not lose
messages. Most custom firmwares concentrate on sound features and do not use it. This project would use
Bluetooth MIDI **in and out** as a core part of the Maker Hip workflow:

- **In:** phone or controller -> FM-1: notes, PLAY / STOP, MIDI clock.
- **Out:** FM-1 -> other gear / apps: the pads' and the sequencer's notes, the FM-1 as the clock master, knobs
  moving faders in the 16 Track app.
- FM-1 + Burger Studio app + 16 Track, all wireless.

Plan: two packages, as Hortator and ORBIT do. The plain Burger Studio stays as it is, untouched. A separate
**Burger Studio BT** adds Bluetooth.

## The source to port: Hortator

Hortator is at <https://github.com/deadactive/hortator> (by DEADACTIVE). It is built on Felucca and licensed
**GPL-3.0-only**, so its code can come into Burger Studio.

**What its Bluetooth does:**

- ROLE DEVICE: a phone or computer connects to the FM-1.
- ROLE HOST: the FM-1 connects to controllers or adapters.
- Saved devices and RECONNECT.
- MIDI clock out.
- FM-Link: two FM-1s in time.
- A Bluetooth page.

**Where the parts are:**

| What | Where in Hortator |
| --- | --- |
| The BLE unit | `firmware/src/ble/` |
| The core's side | `firmware/src/bt_*.c`, `core_ble_api.c` |
| The HAL | `firmware/hal/fm1_ble_hal.h`, `fm1_ctx.*` |
| The linker script | `firmware/app_ble.ld` |
| The tools | `tools/ble_libs.py` (the pinned JieLi SDK libraries), `check_update_path.py`, `check_ble_boot.py`, the BLE path of `tools/build.py` |

**Design documents in Hortator:**

- `docs/superpowers/specs/2026-10-08-ble-midi-design.md`
- `docs/ble/FIT.md`
- `docs/ble/DEVICE_STEPS*.md`

**Build needs:**

- The JieLi AC79 SDK **V1.2.0**, for the BT libraries. They are Apache-2.0 and pinned by sha256. Packaging uses
  V1.2.1 (`ble_libs.py`).
- The BLE build runs the toolchain in Docker. GitHub Actions can fetch the SDK from gitee; this cloud container
  cannot.

## The hard rule: never break the update path

Bluetooth must not be able to stop a firmware update. Hortator had a brick on 2026-10-08. From then on:

- The loader is pinned.
- The update path's sources and machine code are gated.
- No BT code runs at boot.
- The default build is byte-identical to the build without the Bluetooth files.

Burger Studio BT keeps the same rules. Moving code elsewhere in flash, a second image, or compression are not
used, because they touch the update path.

## Known problems with Bluetooth on the FM-1

- Some units show `FAILED: NO RF TRIM IN FLASH`. BT needs the radio calibration stored by the stock firmware.
- Hortator: a saved device that is not connected can make the sound stutter now and then, while the FM-1 looks
  for it.
- fm1-dock: in an early build, a connection fell apart within a fraction of a second on a real FM-1. Later
  builds fixed it.

## Does it fit? (measured on 1.8.2-bs19)

| | used | of | free |
| --- | ---: | ---: | ---: |
| Flash (app slot) | 580,744 B | 581,564 B | **820 B** |
| RAM `.data + .bss` | 63,136 B | 73,728 B | ~10 KB |
| RAM pool (8 KB must stay spare) | 358,448 B | 368,640 B | ~2 KB above the 8 KB |

**What Bluetooth needs** (Hortator's measurements): about **+146 KB flash** and about **+45 KB RAM** (heap,
task stacks, library data).

**Why we are full:** Felucca 1.8.2's engines (FM6, phys, grain, formant, critter, slice, ...), plus the
built-in samples (`SMP_DATA`, 172,598 B), plus the looper and the sampling. Hortator is a smaller drum machine,
so it has the room.

## The options (the user's choice, not decided)

1. **BT build without the built-in samples:** saves ~170 KB of flash. RAM is cut too, for example a shorter
   looper (`bnc_buf`, 28 KiB) or a smaller delay / reverb. Sounds are loaded into the USB slots.
2. **BT build without some synth engines** (FM6 / phys / grain, ...; measure each first), with the RAM cut as
   in 1.
3. **No Bluetooth in the firmware:** the FM-1 connects to the phone with USB-OTG. 16 Track does the MIDI
   (USB + Bluetooth for other controllers). No risk.
4. **3 now; a "Burger Studio BT Lite" later:** a version designed for Bluetooth from the start, with the user
   choosing what it keeps.

Whatever is chosen, the plain Burger Studio (bs19 and after) stays as it is. If 1 or 2 is chosen: measure each
part's real size first, then give the user the list to choose from.

## The stages, when it starts again

| Stage | What | Device test |
| --- | --- | --- |
| BT1 | The BLE core ported, gated. RAM and flash measured. ROLE DEVICE: phone <-> FM-1 MIDI in / out and clock. | A free MIDI app on the phone |
| BT2 | A Bluetooth page in Burger Studio's look: HOST, saved devices, on / off. | The user's controller / M-VAVE adapter |
| BT3 | The site offers both packages: Burger Studio and Burger Studio BT. | — |

After that: MIDI in the 16 Track app (MIDI Learn, PLAY / REC / STOP from a controller, MIDI clock).

## Sources

- Hortator: <https://github.com/deadactive/hortator> (and <https://codeberg.org/armin/hortator>)
- ORBIT 0.10.B (BT ported from Hortator 4e40f27):
  <https://newreleases.io/project/github/dspaudio/orbit/release/v0.10.B>
- ChoralRoot 0.30 (BT MIDI): <https://newreleases.io/project/github/Quixotic7/ChoralRootFM1/release/v0.30>
- fm1-dock 0.7: <https://newreleases.io/project/github/joakimeriksson/fm1-dock/release/v0.7>
- fm1-base (MPL-2.0, BT MIDI, WiFi, USB audio): <https://github.com/charlesvestal/fm1-base>
