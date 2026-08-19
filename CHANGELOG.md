# Changelog

## v1.1.2

 Enforce Fail-Closed Integrity Verification for Wordlist

Updated wordlist verification to follow a **fail-closed** model, ensuring that corrupted or tampered wordlists automatically block phrase generation instead of acting as a passive UI indicator.

* **Promisified Integrity Check:** Refactored the `verifyWordlist()` IIFE to store its execution result directly inside a top-level Promise (`WORDLIST_CHECK`).
* **UI Hard Guard:** Added logic inside the verification IIFE to immediately set `btn.disabled = true` if the wordlist hash check fails (`!pass`).
* **Execution Interceptor:** Injected an `await WORDLIST_CHECK` guard directly into the `generateBtn` click callback before mnemonic creation occurs. If the check resolves to `false`, an alert is triggered and execution halts immediately (`return`).


## Impact

* **Fail-Closed Security:** Prevents generation of invalid or non-BIP39 compliant seed phrases when wordlist integrity is compromised, even if the UI state becomes stale.
* **Race Condition Protection:** Handles slow device environments seamlessly—tapping the generate button before verification completes pauses execution until the promise resolves, eliminating false integrity failures.
* **Zero UX Degradation:** Zero change to normal user experience; for valid wordlists, the check seamlessly passes without user friction.
* Release File Hash: 9e93f6b0aab5dc870ad43c6e2d9d38cec1d8bdc02cd17e5b4b0d0676b7d57e4e
  
## v1.1.1

Security fix: Corrected 64-bit message length encoding in the pure-JS SHA-256 fallback (`sha256Fallback`). JavaScript's `>>>` operator wraps shift counts modulo 32, causing the high 4 bytes of the length field to be encoded incorrectly. This produced invalid hashes for any non-empty message, which would result in invalid BIP39 checksums and mnemonics in environments without `crypto.subtle` (e.g., older browsers, non-secure contexts). Verified against all four NIST FIPS 180-2 test vectors.
Release File Hash: `9fec343f5a21b47faaa49d45b6f02399aa825169a31752e83869a63cc83fb8ee`

## v1.1.0 

 Enhanced 12-Word Security Buffer: Increased 12-word minimum requirement from 52 to **54 dice rolls** (~139.6 bits raw entropy) to provide an extra safety margin against physical die bias.
 Input Locking at Threshold: Automatically locks typing when exact roll targets are reached (54, 65, 78, 91, 104) while preserving navigation keys, Enter, and keyboard shortcuts.
 Paste & Dropdown Handling: Added automatic truncation for long paste inputs and dynamic array trimming when switching to lower word count tiers.
 UX Status Updates: Added real-time feedback messaging 'Optimal inputs reached!' Press "Generate" button.` upon reaching exact roll requirements.
 Release File Hash: `cdf8941de2ec86a706a3b267d88ef8add738baea3132982557d62536a17bf817`
* 
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
