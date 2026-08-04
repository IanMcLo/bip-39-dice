                                       
# 🎲 BIP39 Dice Generator

> Generate Bitcoin BIP39 mnemonic seed phrases from physical dice rolls — offline, air-gapped, and verified.

A single, self-contained HTML file that converts dice rolls into BIP39 mnemonic seed phrases using **standard base-6 entropy conversion**. Zero dependencies. Zero network calls. Works entirely in your browser.

---

## ⚡ Quick Start

1. **Download** `index.html` from this repository
2. **Disconnect** from the internet
3. **Open** the file in your browser
4. **Roll** your dice and enter the results
5. **Generate** your seed phrase

---

## ⚠️ Critical Compatibility Notice

### This tool is NOT compatible with Coldcard or SeedSigner dice rolls.

There are **two fundamentally different and incompatible** methods for converting dice rolls into BIP39 seed phrases. They produce **completely different seed words** from the same physical dice rolls. Neither is "wrong" — they are simply different standards.

### Method 1: Base-6 Conversion (THIS TOOL)

- Treats dice rolls as a **base-6 number** (`1→0, 2→1, 3→2, 4→3, 5→4, 6→5`)
- Converts that number to bytes, truncates/pads to required entropy length
- Appends BIP39 checksum (SHA-256)
- **Used by:** This tool, Ian Coleman BIP39, Cobo Vault, bitcoiner.guide/seed

### Method 2: SHA-256 of ASCII String (COLDCARD / SEEDSIGNER)

- Takes the raw dice roll string (e.g. `"123456"`) and hashes it with SHA-256
- Uses the hash output directly as entropy
- **Used by:** Coldcard, SeedSigner, Krux

### What this means for you

If you enter the same dice rolls into **this tool** and a **Coldcard**, you will get **different seed words**. This is expected and by design. Do not file a bug report — the tools are implementing different standards.

**To verify this tool:** Use [iancoleman.io/bip39](https://iancoleman.io/bip39/) with **"Base 6 [0-5]"** or **"Hex"** entropy mode.

**To verify Coldcard/SeedSigner:** Use their respective official verification tools (e.g. Coldcard's `rolls.py`).

---

## ✅ Verified Compatibility

| Tool / Method | Compatible | Verification Method |
|---------------|------------|---------------------|
| **Ian Coleman BIP39** ([iancoleman.io/bip39](https://iancoleman.io/bip39/)) | ✅ Yes | Use "Base 6 [0-5]" or "Hex" entropy mode |
| **Cobo Vault** | ✅ Yes | Same base-6 conversion |
| **bitcoiner.guide/seed** | ✅ Yes | Use "Base 6 [0-5]" entropy mode |
| **Coldcard** | ❌ **NO** | Uses SHA-256 of ASCII roll string |
| **SeedSigner** | ❌ **NO** | Uses SHA-256 of ASCII roll string |
| **Krux** | ❌ **NO** | Uses SHA-256 of ASCII roll string |

> **Do NOT use this tool to verify Coldcard or SeedSigner dice rolls.** You will get different results. Use the official verification scripts provided by those manufacturers instead.

---

## 🧪 Verified Test Vectors

These test vectors were cross-checked against [iancoleman.io/bip39](https://iancoleman.io/bip39/) using **Hex entropy mode**.

### 12 Words (50 rolls)

| Dice Rolls | Entropy (hex) | Mnemonic |
|------------|---------------|----------|
| `11111111111111111111111111111111111111111111111111` | `00000000000000000000000000000000` | `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about` |
| `61163222616651541112255152666542453126433223114133` | `01fd411b194bdabdf764d36246182a61` | `acid tube egg crater sad galaxy talk omit girl cotton appear sell` |

### 24 Words (100 rolls)

| Dice Rolls | Entropy (hex) | Mnemonic |
|------------|---------------|----------|
| `1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111` | `0000000000000000000000000000000000000000000000000000000000000000` | `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art` |
| `6116322261665154111225515266654245312643322311413353164514153653526116231214346323326366615625622443` | `04b9a5055f25831e04efde5440442f7823a1b4a57fa396a916e5ad8aaca62261` | `again snake donor salad flag monitor beauty wink february acquire armed utility deliver surge nominee virtual note emerge ride force print fantasy maze cycle` |

### How to verify

1. Go to [iancoleman.io/bip39](https://iancoleman.io/bip39/) (download the offline standalone version for security)
2. Check **"Show entropy details"**
3. Set **Mnemonic Length** to 24 Words
4. Select **"Hex [0-9A-F]"** as entropy type
5. Paste the entropy hex from the table above
6. The generated mnemonic should match exactly

---

## 🔐 Security

> **Use this tool on an air-gapped device only.**

- Save the HTML file, disconnect from the internet, then open it.
- Never type real dice rolls into a network-connected device.
- Verify your dice are fair, balanced, and physically randomized.
- The file contains **no external scripts, no analytics, and no network calls**.
- All computation happens locally in your browser via the Web Crypto API.

---

## ✨ Features

- **Single HTML file** — no build step, no dependencies, no external scripts
- **Standard base-6 conversion** — dice rolls treated as a base-6 number (`1→0, 2→1, …, 6→5`)
- **Verified against Ian Coleman** — same rolls produce identical entropy and seed words
- **Multiple lengths** — 12, 15, 18, 21, or 24 words
- **Entropy quality checks** — warns on repeating patterns, sequential runs, and biased rolls
- **Wordlist integrity self-test** — verifies the embedded BIP39 English wordlist on every load
- **Copy-to-clipboard** — for both the mnemonic and raw entropy hex
- **Dark mode UI** — easy on the eyes during long dice-rolling sessions

---

## 📖 How It Works

1. **Dice rolls → base-6 number:** Each roll `1–6` is mapped to digit `0–5`. The full sequence is treated as one large base-6 integer.
2. **Truncate or pad to entropy size:** The integer is converted to bytes and truncated (or zero-padded) to the required entropy length:
   - 12 words → 128 bits (16 bytes, 50 rolls)
   - 15 words → 160 bits (20 bytes, 62 rolls)
   - 18 words → 192 bits (24 bytes, 75 rolls)
   - 21 words → 224 bits (28 bytes, 87 rolls)
   - 24 words → 256 bits (32 bytes, 100 rolls)
3. **Append BIP39 checksum:** SHA-256 of the entropy → first N bits become the checksum.
4. **Map to words:** Entropy + checksum is split into 11-bit chunks, each indexing into the BIP39 English wordlist (2048 words).

---

## 🛠️ Technical Details

| Parameter | Value |
|-----------|-------|
| Wordlist | BIP39 English (2048 words, sorted, verified) |
| Dice mapping | `1→0, 2→1, 3→2, 4→3, 5→4, 6→5` |
| Entropy source | Base-6 integer from dice rolls |
| Checksum | SHA-256 (Web Crypto API) |
| Min rolls (12 words) | 50 |
| Min rolls (24 words) | 100 |
| Bits per roll | ~2.585 (log₂6) |

---

## 🙏 Acknowledgements

- [Ian Coleman](https://iancoleman.io/bip39/) for the canonical BIP39 reference implementation
- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) — Bitcoin Improvement Proposal 39

---

## 📜 License

MIT — use at your own risk. This is security-critical software. Review the code, verify the test vectors, and only use on air-gapped devices.
