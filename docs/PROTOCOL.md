# CS2 crosshair protocol

Observed on October 2, 2026 in CS2 1.41.8.8, SourceRevision 11064488.

The September 30 format has a `CS` prefix followed by 44 base-57 digits, without separators. It encodes 32 bytes. The alphabet is `ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789`. The text digits represent the payload integer least-significant digit first, while the byte array represents that integer in big-endian order. Individual multibyte settings within the payload use little-endian order.

| Bytes | Meaning |
| --- | --- |
| 0 | Sum of bytes 1 through 31, modulo 256 |
| 1 | Format version, currently 1 |
| 2–3 | Reference screen height, uint16 |
| 4 | Style in bits 0–4, recoil in bit 5, center dot in bit 6, T style in bit 7 |
| 5–8 | Crosshair R, G, B, A |
| 9–12 | Outline R, G, B, A |
| 13 | Thickness in bits 0–5, outline mode in bits 6–7 |
| 14–15 | Signed gap, int16 |
| 16 | Length |
| 17 | Dynamic spread limit |
| 18–21 | Packed classic split and scope color settings |
| 22 | Scope dot scale × 100, minus 10 |
| 23–31 | Reserved, observed zero |

The uint32 at bytes 18–21 contains split distance in bits 0–6, inner split alpha × 100 in bits 7–13, outer split alpha × 100 minus 30 in bits 14–20, split size ratio × 100 in bits 21–27, and use-crosshair-color-for-scope-dot in bit 28. Bits 29–31 are reserved. Unknown version/reserved fields are rejected to avoid silently losing new settings.

## Game reference evidence

The initial game export was `CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj`. Its payload was:

```text
e90138044400c8ffff000000b481010001ff0832c5135a000000000000000000
```

Changing the game style to Classic Dynamic and scope dot scale to 0.45 produced `CSxMSnbcU6TWxCqXiHQJnOiZUdmH7fYtzVys2xfV3kqTBa`. The scale byte changed from 90 to 35, confirming the offset/quantization.

The new implementation generated `CSsNwa7oeYoRNiRWDNFuWkKojpTuqO7f4KyCsaUxonMtqD`. The running game imported it and exported exactly the same code. It exercised Static Quadrant, custom crosshair and outline RGBA values, half outline, 0.58 quadrant size, packed split alphas 0.67 and 0.43, disabled scope color inheritance, and scope scale 1.37.

## Research boundary

The previous delli.cc code was not used. Valve's current menu contract was read from the [settings XML](https://github.com/SteamDatabase/GameTracking-CS2/blob/master/game/csgo/pak01_dir/panorama/layout/settings/settings_crosshair.xml), [menu visibility script](https://github.com/SteamDatabase/GameTracking-CS2/blob/master/game/csgo/pak01_dir/panorama/scripts/settingsmenu_crosshair.js), [English labels](https://github.com/SteamDatabase/GameTracking-CS2/blob/master/game/csgo/pak01_dir/resource/csgo_english.txt), and [convar dump](https://github.com/SteamDatabase/GameTracking-CS2/blob/master/DumpSource2/convars.txt).

The older CSGO layouts were checked against the published [akiver/csgo-sharecode protocol implementation](https://github.com/akiver/csgo-sharecode), and the public [vora.tools crosshair tool](https://www.vora.tools/crosshair) informed the new envelope and basic byte offsets. The packed split/scope fields were decoded and checked against the running game. The runtime codec was implemented independently here; no third-party application implementation is bundled.
