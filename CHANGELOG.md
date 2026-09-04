# Changelog

## v1.1.7

### Added

- **Mnemonic verification feature** paste an existing recovery phrase to check its BIP-39 checksum, reusing the existing WORDLIST and sha256() implementation (word → index → bits → entropy/checksum split → SHA-256 compare).
"Verify Mnemonic" UI section: masked input field with show/hide toggle, Verify button, and dedicated Clear button.
Known-answer test for the verifier added to the on-load self-test suite (official all-zero-entropy vector + its checksum-broken counterpart), so verification correctness is now part of the same integrity gate as wordlist and generation checks.
Changed:
- **Verify result no longer displays raw entropy hex by default** — shows "✅ Valid BIP-39 checksum" plus, when a mnemonic was generated earlier in the session, whether the pasted phrase matches or doesn't match that seed. Reduces the number of full secret representations left on screen.
- **Verify section's Clear button now clears only the pasted phrase and result** not the dice rolls or generated mnemonic (previously shared the same "wipe everything" handler).
input[type="password"] now styled identically to input[type="text"] for visual consistency.
Fixed
- **Verify field is now covered by the same non-persistence hardening as the generator** burn-after-reading auto-clear, the panic double-Escape hotkey, Hard Reset, and beforeunload cleanup.
- **Hard Reset's input sweep now also matches input[type="password"]**, so it can no longer skip the verify field.
Pasting into the verify field now attempts to scrub the OS clipboard shortly after, if it still holds exactly what was pasted (mirrors the existing copy-to-clipboard auto-clear logic).
Long entropy hex string in the verify result no longer overflows off-screen (word-break/overflow-wrap added).
Verify button now fails closed if the wordlist/self-test integrity check hasn't passed, matching the existing behavior of the Generate button.
Removed a stray checked attribute on the clipboard toggle checkbox that contradicted its actual (off-by-default) runtime state.

## v1.1.6

### Added

- **Chi-Squared Die-Bias Check (Audit Terminal, Advanced):** With the Audit Terminal's "Advanced" toggle enabled, a live chi-squared goodness-of-fit test (df=5, α=0.05, critical value 11.070) now runs against the six observed die-face counts, updating on every valid keystroke. Below 30 rolls it reports "need more rolls" rather than a misleading tick/cross — 30 is the minimum needed for each face's expected count (n/6) to clear the ≥5 threshold the chi-squared approximation requires.
- **Lag-1 Autocorrelation Check (Audit Terminal, Advanced):** A second, independent test flags sequential correlation between consecutive rolls (e.g. one face systematically following another) using a Fisher z-transform (two-tailed, α=0.05, |z| > 1.96). A full pairwise (36-bin) chi-squared test would need n ≥ 180 to be statistically valid — more rolls than any tier collects — so this test avoids binning entirely to stay valid at current roll counts. Shares the same 30-roll minimum as the chi-squared check.

Both checks are diagnostics about the **physical dice**, not the entropy math, and are **informational only** — they surface a ✔️/⚠️ line with supporting stats, but never affect the accept/reject verdict, which remains governed solely by the exact rejection-sampling gate (`X < T`). Consistent with the existing safe-by-default design of the Audit Terminal, both are gated behind the "Advanced" toggle alongside the raw N/r/T/X figures, since face counts and the autocorrelation coefficient are derived from the actual roll values rather than being privacy-safe aggregate statistics like the default P(reject)/verdict lines.

### Verification

- Simulated fair, deliberately-biased, and deliberately-correlated die sequences to confirm both tests separate cleanly at their stated thresholds; ran 2,000 fair-roll trials to confirm the autocorrelation test's false-positive rate lands near its nominal 5% (observed 4.25%).
- Confirmed brace/paren balance across both `<script>` blocks after the change.
- Confirmed no naming collisions with existing audit-terminal variables (`r` is reused for the rejection-sampling remainder and the correlation coefficient in adjacent scopes; the latter is destructured under an alias to avoid shadowing).

*Release File Hash: `944818f7c6a6994342e635226e713ede7f3b9ab08c437805d14ab05991661257`*


## v1.1.5

### Input Validation and UX

- Replaced silent D6-input filtering with strict validation and visible error feedback.
- Added `parseRollString()` and wired it into entropy generation.
- Added support for optional whitespace between rolls while preserving compact input.
- Invalid characters now remain visible, receive `.invalid` styling, and disable Generate.
- Updated word-count changes and reset actions to preserve consistent validation behavior.
- Added safeguards so input validation cannot override a failed wordlist integrity check.

### Verification

- Re-ran JavaScript syntax checks, SHA-256 tests, BIP-39 vectors, and the D6 roll-to-entropy known-answer test.
- Confirmed compact and whitespace-separated roll strings produce identical entropy.
- Preserved the existing bounded rejection-sampling entropy conversion and security protections.

_Release File Hash: `a0905fb1e07500af38a8ca0d93e3268492eff04f743df1f3e917f3ed45881fdb`_


##  v1.1.4 
### Added
- **Bounded Rejection Sampling:** Replaced the bounded-bias trim with exact rejection sampling. Modulo bias is now mathematically **zero**. If the base-6 roll integer falls into the remainder zone ($X \ge T$), generation is safely refused.
- **Modulo Bias Audit Terminal:** A floating action button (🔬) opens a live bottom sheet detailing the exact BigInt math (N, R, r, T, X) and the live accept/reject verdict on every keystroke.
- **Collapsible Status Pill:** The on-load self-test success message now collapses to a single line on mobile to save screen space (tap to expand).
- **Desktop-Responsive Sheet:** The audit terminal bottom sheet becomes a centered 800px card with rounded corners on screens ≥768px wide.

### Changed
- **Enhanced Entropy Buffer:** Increased the minimum required dice rolls by exactly +1 for each word tier to further widen the cryptographic safety margin:
  - 12 words: 54 → **55 rolls** (~142.2 bits raw)
  - 15 words: 65 → **66 rolls** (~170.6 bits raw)
  - 18 words: 78 → **79 rolls** (~204.2 bits raw)
  - 21 words: 91 → **92 rolls** (~237.8 bits raw)
  - 24 words: 104 → **105 rolls** (~271.4 bits raw)
- **Mobile-Friendly Alerts:** Rejection alert messages are now concise; removed giant BigInt printouts that caused mobile scrolling issues.

### Security
- Self-tests remain fail-closed. The rejection sampling guarantees exactly uniform entropy.

*Release File Hash: ` b5013912373893fc1593c8d8ca723685684500c8393f3efddc91ffb973017ebe`*

## v1.1.3

Added Embedded Known Answer Self-Tests

- Embedded known-answer self-tests (KATs), run on every page load:
  - SHA-256 FIPS-180 vectors (pure-JS fallback + live wrapper)
  - Rolls→entropy packing/trim vector (54-roll base-6 → 3bf055a1…)
  - 4 official BIP-39 entropy→mnemonic vectors (128-bit + 256-bit)
    
- Any self-test failure is fail-closed: red status box, Generate disabled.
  
- Release File hash:
 7c64606457bf4cef529111efb854c9475495dc24cfe912d998685945cb181f05
  



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
