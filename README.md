# 🎲 BIP39 Dice Roll Seed Generator

A single-file, offline, cryptographically auditable BIP-39 seed phrase generator driven by physical dice rolls.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/IanMcLo/bip-39-dice/blob/main/LICENSE) [![HTML 100%](https://img.shields.io/badge/HTML-100%25-orange)](https://github.com/IanMcLo/bip-39-dice/blob/main)

Built for security purists: this tool uses **exact rejection sampling** to reduce modulo bias to mathematically **zero**, features on-load Known Answer Tests (KATs) that fail-closed, and includes a live Modulo Bias Audit Terminal so you can verify the math yourself.

## 🛡️ Security & Features

- **Zero Modulo Bias (Rejection Sampling):** The base-6 roll integer is mapped to the target $2^b$ space. If the integer falls into the remainder zone ($X \ge T$), the tool refuses to generate and asks you to re-roll.
- **Live Modulo Bias Audit Terminal:** A floating action button (🔬) opens a live audit sheet showing target size, roll count, and the live verdict (✅ ACCEPT or ⛔ REJECT) on every keystroke. By default the sequence-derived math (N, r, T, and the roll-derived integer X) stays hidden — those values are computed from your actual dice rolls and shouldn't sit on screen or in a screenshot during ordinary use. An explicit "Show advanced values" toggle in the audit sheet reveals them for anyone who wants to verify the math directly.
- **On-Load Self-Tests (Fail-Closed):** Every page load verifies the SHA-256 implementation, the official BIP-39 wordlist hash, the roll-to-entropy packing, and 4 official BIP-39 test vectors. If any test fails, the Generate button is disabled.
- **Strict Input Validation:** The dice-roll field only accepts digits 1–6 and optional whitespace. Anything else is flagged immediately with a visible error and disables Generate — invalid characters are never silently discarded, so a mistyped digit can't quietly change your entropy without you noticing.
- **Enhanced Entropy Buffers:** Minimum roll requirements are increased across all tiers to maximize the cryptographic safety margin:
  * **12 words:** 55 rolls (~142 bits raw)
  * **15 words:** 66 rolls (~170 bits raw)
  * **18 words:** 79 rolls (~204 bits raw)
  * **21 words:** 92 rolls (~238 bits raw)
  * **24 words:** 105 rolls (~271 bits raw)
- **Clipboard-Aware Reset:** Copying the seed phrase or entropy hex auto-clears the clipboard 45 seconds later — but only if it still holds exactly what was copied, so nothing else you copy in the meantime gets clobbered. "Clear Rolls" and "Hard Reset" both attempt the same clipboard clear immediately, alongside wiping the DOM and nullifying closure-scoped JavaScript variables. Note this is a best-effort clear, not guaranteed secure erasure — no web app can force the OS or other apps to forget a value once it's been on the clipboard.
- **Mobile-First & Desktop-Ready:** Responsive bottom sheets, collapsible status pills, and native numeric keypads for phones; centered audit cards for desktops.

## 📦 Verification

To ensure the file you downloaded hasn't been tampered with, verify the SHA-256 checksum.

**Option 1: Sidecar file (Linux/macOS)** Download `index.html.sha256` into the same folder and run:

```
sha256sum -c index.html.sha256
# Expected output: index.html: OK
```

**Option 2: Manual Hash** Hash your local `index.html` file using any trusted SHA-256 tool and compare it against the published hash in `index.html.sha256`.

## 💻 Usage

1. **Air-gap your device:** Disconnect from the internet.
2. Open `index.html` in any modern browser.
3. Wait for the green "✅ Wordlist + self-tests verified" pill to appear.
4. Select your desired word count (12–24 words).
5. Roll a physical 6-sided die and enter the numbers into the input field, one digit per roll. Whitespace is fine if you want to group rolls visually — it's ignored either way — but any other character will be flagged as invalid rather than silently dropped.
6. Tap the 🔬 button to watch the live rejection sampling verdict; toggle "Show advanced values" if you want to see the underlying math.
7. Once you hit the target roll count, tap **Generate Seed**.
8. Write down your phrase, tap **Clear / Reset**, and power off the device.

## 📄 License

MIT – use at your own risk. This is security‑critical software.
Review the code, verify the outputs against known test vectors, and **only use on air‑gapped devices**.
