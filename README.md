# 🎲 BIP39 Dice Roll Seed Generator

A single-file, offline, cryptographically auditable BIP-39 seed phrase generator driven by physical dice rolls.

Built for security purists: this tool uses **exact rejection sampling** to reduce modulo bias to mathematically **zero**, features on-load Known Answer Tests (KATs) that fail-closed, and includes a live Modulo Bias Audit Terminal — now with statistical die-fairness checks — so you can verify the math yourself.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![HTML 100%](https://img.shields.io/badge/HTML-100%25-orange)]()

## 🛡️ Security & Features

- **Zero Modulo Bias (Rejection Sampling):** Instead of bounding the bias, v1.1.4 eliminates it. The base-6 roll integer is mapped to the target $2^b$ space. If the integer falls into the remainder zone ($X \ge T$), the tool refuses to generate and asks you to re-roll.
- **Live Modulo Bias Audit Terminal:** A floating action button (🔬) opens a live audit sheet showing the exact BigInt math (N, R, r, T, X) and the live verdict (✅ ACCEPT or ⛔ REJECT) on every keystroke.
- **Live Die-Fairness Checks (v1.1.6, Advanced):** With the Audit Terminal's "Advanced" toggle enabled, it also runs a chi-squared goodness-of-fit test on the six observed face counts and a lag-1 autocorrelation test for sequential patterns, each showing ✔️ or ⚠️ once at least 30 rolls have been entered. These are diagnostics about the physical dice, not the entropy math — **informational only**, gated behind Advanced like the rest of the raw math, and the accept/reject decision is unaffected either way.
- **On-Load Self-Tests (Fail-Closed):** Every page load verifies the SHA-256 implementation, the official BIP-39 wordlist hash, the roll-to-entropy packing, and 4 official BIP-39 test vectors. If any test fails, the Generate button is disabled.
- **Enhanced Entropy Buffers:** Minimum roll requirements have been increased by +1 across all tiers to maximize the cryptographic safety margin:
  * **12 words:** 55 rolls (~142 bits raw)
  * **15 words:** 66 rolls (~170 bits raw)
  * **18 words:** 79 rolls (~204 bits raw)
  * **21 words:** 92 rolls (~238 bits raw)
  * **24 words:** 105 rolls (~271 bits raw)
- **Memory Wipe:** A dedicated Hard Reset button explicitly nullifies closure-scoped variables and clears the DOM.
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
5. Roll a physical 6-sided die and enter the numbers into the input field.
6. Tap the 🔬 button to watch the live rejection sampling math; enable "Advanced" to also see the live chi-squared and autocorrelation die-fairness checks once you've entered 30+ rolls.
7. Once you hit the target roll count, tap **Generate Seed**.
8. Write down your phrase, tap **Clear / Reset**, and power off the device.

> 🌐 A live demo is available at <https://ianmclo.github.io/bip-39-dice/> for evaluation only. For real seed generation, use the downloaded,
> checksum-verified file on an air-gapped device.

## 📄 License

MIT – use at your own risk. This is security‑critical software.
Review the code, verify the outputs against known test vectors, and **only use on air‑gapped devices**.
