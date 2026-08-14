# Changelog
## v1.0.9
Security: Attached a hardResetBtn listener inside the DOMContentLoaded closure to explicitly clear local currentMnemonic and currentEntropy variables before calling window.hardReset(). Removed currentMnemonic and currentEntropy from globalsToWipe, delegating closure-scoped state cleanup directly to the main DOM closure.
## v1.0.8
Security: moved currentMnemonic and currentEntropy from window global to closure-scoped let variables — prevents browser extensions or injected scripts from reading generated seeds
Cryptography: increased minimum dice rolls to reduce modulo bias in base-6 → base-16 conversion — 12 words: 50→52, 15 words: 62→65, 18 words: 75→78, 21 words: 87→91, 24 words: 100→104
Updated index.html.sha256 outer file checksum
Updated UI labels and live roll counter to reflect new exact roll counts
## v1.0.7
Added full cryptographic wordlist integrity verification — on page load the generator SHA-256 hashes the entire 2048-word BIP39 array and compares it against a hard-coded canonical hash. This detects any added, deleted, or misspelled words in addition to the existing length, sortedness, and spot-check validations.
Updated index.html.sha256 outer file checksum to match the modified index.html.
## v1.0.6
Fixed SHA-256 generation using the browser's native SHA-256 implementation
Corrected dice-to-entropy conversion using base-6 → base-256 conversion
Fixed displayed hexadecimal entropy so it matches the generated seed
Fixed reset behaviour so generated content is cleared without destroying the UI
Corrected the 18-word requirement from 74 to 75 dice rolls
Fixed persistent mnemonic/entropy state being retained after reset
## v1.0.5
Added live roll counter with colour-coded progress bar
Added word count selector (12/15/18/21/24 words)
Added entropy statistics panel (time to crack, avg bits per roll)
## v1.0.4
Added exact entropy validation per word count selection
## v1.0.3
Added pure-JS SHA-256 fallback for non-secure contexts (file://, HTTP)
## v1.0.2
Fixed wordlist: added missing huge and vanish, removed erroneous revolution — now correctly 2048 words
Fixed checksum formula: changed from 32 - (bits.length / 32) to bits.length / 32 — previously generated invalid BIP39 mnemonics
## v1.0.1
Initial release
