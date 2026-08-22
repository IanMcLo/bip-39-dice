# Technical & Cryptographic Specification

This document describes the information-theoretic foundations, entropy bounds, framing pipeline, and security model of the `bip-39-dice` physical seed generator. It is intended as a precise, implementable reference for auditors and advanced users.

> **v1.1.4 note:** This revision documents a change from unconditional modulo reduction (which left a small, permanent statistical bias in every output) to **bounded rejection sampling** (which makes every *accepted* output exactly uniform, at the cost of occasionally asking the operator to re-roll). Required roll counts increased by one roll per tier to reduce how often that occurs. Sections 5, 6, 7, 9, and 11 have been rewritten; Sections 1–4, 8, and 10 are structurally unchanged.

---

## 1. Information-Theoretic Foundations

### 1.1 Physical Entropy Source and Bernoulli Mapping

The physical entropy source is repeated independent rolls of a fair six-sided die. For the purposes of estimating binary entropy, we map each roll to one bit using a simple partition:

- Roll ∈ {1, 2, 3} → 0
- Roll ∈ {4, 5, 6} → 1

Under the fair-die assumption this produces independent and identically distributed (i.i.d.) Bernoulli trials with p = 0.5.

Shannon entropy per roll:

$H(X) = -sum_{x in {0,1}} P(X=x) log2 P(X=x) = -(0.5 log2 0.5 + 0.5 log2 0.5) = 1.00$ bit/roll$.

Min-entropy per roll (worst-case single-trial predictability):

$$H_/infinity(X) = -log2(max_x P(X=x)) = -log2(0.5) = 1.00 bit/roll$$.

Because Shannon entropy and min-entropy are equal under p = 0.5, each mapped roll contributes one full bit of entropy in both average and worst-case senses prior to software processing.

Note: This binary mapping is for entropy accounting and statistical analysis. The generator also supports base-6 encoding of rolls (1→0, 2→1, …, 6→5) for constructing raw entropy by treating runs of rolls as base-6 digits and converting to a fixed-length byte array.

---

## 2. Framing, Checksum and Word Slicing

### 2.1 Raw Entropy Lengths

BIP-39 requires raw entropy lengths E that are multiples of 32 bits. Standard choices and corresponding checksum lengths are:

| Mnemonic Length | Raw Entropy E | Checksum bits CS = E / 32 | Total bits (E + CS) |
|---|---|---|---|
| 12 words | 128 | 4 | 132 |
| 15 words | 160 | 5 | 165 |
| 18 words | 192 | 6 | 198 |
| 21 words | 224 | 7 | 231 |
| 24 words | 256 | 8 | 264 |

### 2.2 Checksum Derivation (SHA-256)

Compute the SHA-256 digest over the raw entropy byte array as produced by the implementation:

Digest = SHA-256(RawEntropy_bytes).

Take the first CS bits of the Digest as the checksum bits (the most significant bits of the digest stream):

Checksum = Digest[0 : CS - 1].

Concatenate the raw entropy bitstring and the checksum bits to form the full bitstream S of length L = E + CS.

Cryptographic note: SHA-256 is used only to compute deterministic checksum bits; it does not increase the min-entropy of the raw E-bit sequence. The attacker's search space is bounded by 2^E.

### 2.3 11-bit Word Indices

Partition S into contiguous 11-bit chunks and interpret each chunk in MSB-first order to produce the BIP-39 word indices:

$W_k = sum_{i=0}^{10} S[11k + i] × 2^{10-i}$,

where W_k is the integer value of the k-th 11-bit block in MSB-first bit ordering. Each W_k ∈ [0, 2047] indexes the BIP-39 English wordlist.

Implementation caveat: the bitstream S is constructed from the raw entropy bytes using the implementation's byte ordering. Always verify using the displayed raw entropy hex.

---

## 3. Empirical vs. Theoretical Min-Entropy

Short sample sizes and the chosen measurement resolution can create apparent reductions in empirical min-entropy that do not reflect a true loss of cryptographic strength.

### 3.1 Single-Bit Variance Example (160 bits)

A uniformly random 160-bit string has expected number of ones

$\mu = 160 × 0.5 = 80$

and standard deviation

$\sigma = sqrt(160 × 0.5 × 0.5) = sqrt(40) ≈ 6.3246$.

Observing 82 ones corresponds to $$z = (82 - 80)/sigma ≈ 0.316$$, well within typical statistical fluctuation and not evidence of reduced entropy.

### 3.2 Byte-Level Sampling Artifacts

When viewing N = 20 bytes (160 bits) as 8-bit symbols, the maximum empirical frequency for a distinct byte value is 1/20 = 0.05 if all bytes are distinct. A naive calculation using that per-byte frequency as if bytes were independent symbols can under-estimate entropy for short samples.

Practical recommendation: use bitwise statistics or aggregate many samples before inferring entropy degradation.

---

## 4. Downstream Key-Derivation Architecture

After generating and verifying the mnemonic, standard wallet software expands the mnemonic into a seed using PBKDF2-HMAC-SHA512 as specified by BIP-39:

Seed = PBKDF2-HMAC-SHA512(Mnemonic, "mnemonic" || Passphrase, 2048, 512)

This KDF both stretches and mixes the mnemonic (and optional passphrase), producing 512 bits of master seed material used by downstream HD key derivation (BIP-32, etc.). Because PBKDF2 is a pseudorandom function keyed by the mnemonic, it acts as a randomness extractor: small, non-adversarial statistical biases in the input are reduced by the PRF construction.

Security note: the extracted seed's security cannot exceed the entropy in the original mnemonic; thus the dominant security parameter is the raw entropy length E.

---

## 5. Bounded Rejection Sampling: Exact Elimination of Modulo Bias

**This section replaces the "over-sampling bounds the bias" argument used in prior revisions.** The current implementation does not merely make bias *small* — it makes bias **exactly zero** for every mnemonic it actually produces. The trade-off is that a small, disclosed fraction of roll sequences are rejected outright and must be re-rolled from scratch, rather than silently accepted with a residual skew.

### 5.a Defining the Spaces

Let $k$ be the number of dice rolls. The total number of unique base-6 outcomes is:

$$N = 6^k$$

Let $b$ be the target number of bits (e.g., 128 bits for 12 words, 256 bits for 24 words). The target range is:

$$R = 2^b$$

Because $6^k$ is never an exact multiple of $2^b$ in this parameter regime — $6^k = 2^k \cdot 3^k$ has exactly $k$ factors of 2, and $k$ is always far smaller than $b$ — $N$ never divides evenly into $R$-sized buckets. Let

$$r = N \bmod R, \qquad T = N - r$$

$T$ is the **largest multiple of $R$ that is $\le N$**.

### 5.b The Rejection Rule

Given the BigInt $X$ formed from the dice rolls ($0 \le X < N$):

- **If $X \ge T$:** reject. This range holds exactly $r$ leftover outcomes that cannot be split evenly across the $R$ buckets. The generator halts, discards the sequence, and instructs the operator to clear all rolls and re-roll from scratch.
- **If $X < T$:** accept. Output $X \bmod R$.

### 5.c Why This Is *Exact*, Not Approximate

The interval $[0, T)$ contains exactly $T = qR$ outcomes, where $q = T/R$ is an integer. Because $T$ is by construction a multiple of $R$, the map $X \mapsto X \bmod R$ sends **exactly $q$** values of $X$ to each of the $R$ possible outputs — no output is favored over any other. This is a discrete counting fact, not a statistical bound:

$$\forall\, v \in [0, R): \; \left|\{X \in [0, T) : X \bmod R = v\}\right| = q$$

So conditioned on acceptance, the output is **perfectly uniform** over $[0, R)$. Total variation distance from uniform is exactly $0$ for accepted outputs — there is no residual bias to bound or reason about probabilistically.

### 5.d Quantifying the Rejection Probability

The only remaining question is *how often* generation is rejected, not *how biased* the output is when accepted:

$$P(\text{reject}) = \frac{r}{N} = \frac{N \bmod R}{N}$$

Because $r < R$ always, this is strictly bounded above by:

$$P(\text{reject}) < \frac{R}{N} = 2^{-(H - b)}, \quad \text{where } H = k \cdot \log_2(6)$$

This $2^{-(\text{Buffer}_{\text{bits}})}$ figure is a **provable worst-case upper bound**, useful for choosing roll counts in advance. The *exact* rejection probability depends on the specific residue $6^k \bmod 2^b$ and must be computed directly; it is always at least as good as (i.e., no larger than) the bound above.

### 5.e Case Analysis, Current Roll Counts

The table below gives both the worst-case bound (from the buffer-bits estimate) and the **exact** rejection probability computed directly from $N \bmod R$, for the roll counts currently used by the generator.

| Words | Rolls ($k$) | Target bits ($b$) | Raw bits ($H = k\log_2 6$) | Buffer ($H-b$) | Bound: $2^{-\text{Buffer}}$ | **Exact** $P(\text{reject})$ |
|---|---|---|---|---|---|---|
| 12 | 55 | 128 | 142.17 | 14.17 | 1 in 18,471 | **1 in 34,938** |
| 15 | 66 | 160 | 170.61 | 10.61 | 1 in 1,560 | **1 in 7,409** |
| 18 | 79 | 192 | 204.21 | 12.21 | 1 in 4,744 | **1 in 9,666** |
| 21 | 92 | 224 | 237.82 | 13.82 | 1 in 14,428 | **1 in 21,743** |
| 24 | 105 | 256 | 271.42 | 15.42 | 1 in 43,874 | **1 in 85,691** |

Every tier's exact rejection rate is better than its worst-case bound, but the bound is what should be used when reasoning about new roll counts, since the exact value depends on arithmetic idiosyncrasies of $6^k \bmod 2^b$ for that specific $k$.

**Interpretation:** an operator will, on average, need to re-roll an entire sequence somewhere between roughly 1-in-7,400 and 1-in-86,000 times depending on word count. This is a usability cost, not a security concern — a rejected sequence is simply never converted into output, so it never affects the security of any mnemonic that *is* produced.

---

## 6. Retired: "Trimming Left" Justification

Earlier revisions of this document justified taking the low-order hex characters of the base-6 integer (`hex.slice(-requiredHexLen)`) as an informal argument that the final dice rolls "flip the low bits chaotically" and therefore the truncated output was safe to use unconditionally, with the residual bias absorbed by an oversampling buffer.

**That argument, and the code path it described, are no longer applicable.** The current implementation does not unconditionally truncate. It performs the explicit accept/reject test in Section 5 before any reduction occurs, and only *then* reduces via `X mod 2^b` — which, restricted to the accepted domain $[0, T)$, is exactly uniform by the counting argument above rather than merely "probably fine." Auditors reviewing older forks or cached copies of this tool should confirm which code path (unconditional modulo vs. gated rejection sampling) is actually present before relying on either justification.

---

## 7. Implementation & Interoperability Notes

- **Byte/bit ordering:** The implementation treats the first recorded die roll as the most significant base-6 digit (MSB-first). The accumulated base-6 integer $X$ is compared against the rejection threshold $T$ (Section 5) *before* any formatting occurs.

- **Rejection gate:** If $X \ge T$, the generator throws immediately and displays the exact rejection percentage for the selected tier; no entropy, hex, or mnemonic is produced or displayed. The operator must clear all rolls and re-enter a fresh sequence — partially editing a rejected sequence does not restore the uniformity guarantee, since the accept/reject decision and the modulo reduction both depend on the *entire* sequence as a single integer.

- **Modulo reduction (accepted case only):** If $X < T$, the output is $X \bmod 2^b$, formatted to the exact target byte length ($2 \times \text{requiredBytes}$ hex characters), left-padded with zeros if necessary.

- **Elevated roll counts:** Roll counts per tier (55 / 66 / 79 / 92 / 105 for 12/15/18/21/24 words respectively) are chosen to keep the exact rejection probability low — see Section 5.e — while keeping the number of physical dice rolls an operator must perform manageable. These counts include a full extra roll beyond the previous revision's counts, specifically to reduce how often the rejection path is hit.

- **Input Locking & UX Boundaries:** The UI enforces strict input locking upon reaching the exact target roll count for the selected tier (55, 66, 79, 92, or 105 rolls). Keystrokes are capped at the target, and pasted strings are automatically truncated to match the exact requirement for the selected word tier.

- **Verification:** When verifying outputs with third-party tools (e.g., Ian Coleman's BIP-39 tool), paste the displayed raw hex entropy — not the raw dice rolls. Re-entering raw rolls into a tool using a different roll-to-byte convention, or one without a rejection-sampling gate, will produce a different value; compare on the entropy hex, not the roll string.

- **Cryptographic Primitives:** Mnemonic key derivation (by downstream wallet software) uses PBKDF2-HMAC-SHA512 per BIP-39. SHA-256, used here only for the checksum and for a wordlist-integrity self-check, is provided natively by `window.crypto.subtle` with a pure-JS fallback for offline `file://` access. The pure-JS fallback is validated on every page load against published SHA-256 known-answer tests (empty string and `"abc"`), and the full entropy→mnemonic pipeline is validated against four official BIP-39 test vectors before the Generate button is enabled — generation is refused if any self-test fails.

---

## 8. Threat Model & Operational Security

This section summarises the physical and operational assumptions made by the generator and gives concise guidance for safe use.

The generator stores the mnemonic and entropy in closure-scoped variables (not window globals) to prevent exposure to browser extensions or injected scripts.

- **Assumptions:** The generator assumes dice are rolled by an honest operator in a physically private environment and that the recording medium (paper or device) is under the operator's control during generation.

- **Threats considered:** Shoulder-surfing or covert recording, biased or tampered dice, accidental leakage via networked devices, and operator error when re-entering or transferring entropy/mnemonic data.

- **Operational recommendations:**
  * Roll and record in private; remove cameras, disable microphones, and avoid network-connected devices in the immediate area while generating entropy.
  * Use standard, undamaged dice from a reliable source. If in doubt, perform quick chi-square checks on a sample of rolls or use multiple dice and aggregate results.
  * If the tool reports a rejection-sampling trigger, clear the entire input and re-roll all dice from scratch. Do not try to "fix" a rejected sequence by editing a few digits — the accept/reject test and the modulo reduction both depend on the full sequence as one integer, so a partial edit does not restore either guarantee.
  * Prefer an air-gapped computer for converting rolls to entropy, or use paper and an offline reproducible script, to reduce attack surface. If a device is used, verify the binary or HTML artifact's checksums prior to use.
  * Do not paste raw entropy or the mnemonic into online web pages or networked tools. Transfer only the raw entropy hex using an offline method when cross-verification is required, and verify on an independent, air-gapped machine.
  * Treat raw entropy hex and the mnemonic as highly sensitive. Avoid copying them to clipboards on networked systems.

- **Out of scope:** Supply-chain compromises of cryptographic libraries, OS-level compromise of the recording device, and coercion attacks against the operator.

---

## 9. Common Pitfalls and How to Avoid Them

- **Re-typing dice rolls into other tools:** Always verify by using the displayed raw entropy hex rather than re-typing roll sequences into third-party tools, which may use a different roll-to-byte convention and will not apply the same rejection-sampling gate.

- **Byte/bit ordering mismatch:** This project treats the first recorded roll as the most significant base-6 digit and outputs big-endian hex. Other tools may use different conventions. Use the displayed hex when cross-checking.

- **Confusing encodings:** Binary mapping (1–3 → 0, 4–6 → 1) used for bit accounting in Section 1 is distinct from the base-6 digit mapping (digit = roll − 1) used for entropy construction. Use the correct mapping for the intended purpose.

- **Editing a rejected sequence instead of re-rolling:** After a rejection-sampling trigger, the correct response is to clear all rolls and re-roll the full sequence — see Section 8.

- **Assuming the minimum-entropy roll count is the same as the required roll count:** The information-theoretic minimum for, e.g., 128 bits is $\lceil 128 / \log_2 6 \rceil = 50$ rolls, but the generator requires 55 for the 12-word tier specifically to keep the rejection probability low (Section 5.e). Using only the theoretical minimum with no buffer would make rejection far more frequent and is not what this tool implements.

- **Exposing the mnemonic:** Never paste the mnemonic into networked web pages. Use local, audited tools for any additional verification.

---

## 10. Trusted Code Base & Audit Checklist

For auditors and advanced users, verify the following before using this tool in a threat-sensitive workflow:

- Identify the implementation files for entropy collection and conversion (dice parsing, base-6 → BigInt, the rejection-sampling gate, integer → byte array, checksum, and word slicing). Confirm these are the only code paths used during generation.
- Confirm the rejection threshold is computed as $T = N - (N \bmod R)$ and that the comparison $X \ge T$ **halts generation** rather than silently falling through to a modulo reduction — this is the security-critical control introduced in this revision.
- Confirm the sources and versions of cryptographic primitives (Web Crypto API, and the name/version of any bundled pure-JS SHA-256 implementation). Prefer native, well-maintained libraries.
- Specify acceptable runtime environments (e.g., offline browser via `file://`, Node.js in an air-gapped machine) and document any environment caveats.
- Reproducible builds: publish artifact checksums and provide build instructions so auditors can reproduce release artifacts and verify integrity.

Suggested audit checklist:

- Confirm the implementation files for dice → BigInt → rejection gate → hex → mnemonic and list their paths.
- Confirm SHA-256 implementation(s) and their origins/versions, and confirm the bundled known-answer tests pass.
- Reproduce both worked examples in Section 11 (accept and reject) in an air-gapped environment using the provided build.
- Verify there are no network calls, telemetry, or remote loading in the artifact used for generation.
- Verify release artifact checksums/signatures.

---

## 11. Worked Examples — 12 words (55 rolls)

These examples demonstrate both outcomes of the rejection-sampling gate for the 12-word tier at the current roll count.

**Shared parameters:** Target 12 words ($E = 128$ bits, 16 bytes), $k = 55$ rolls, $N = 6^{55}$, $R = 2^{128}$, $r = N \bmod R = \texttt{0x8756d0073182ef9be580000000000000}$, $T = N - r = \texttt{0x482600000000000000000000000000000000}$.

### 11.a Accept Path

- **Roll sequence:** `4, 3` followed by 53 rolls of `1` (55 rolls total).
- **Digits** (roll − 1): `[3, 2, 0, 0, …, 0]`.
- **Base-6 BigInt:** $X = \texttt{0x281567a201cb1b81a18f7f80000000000000}$.
- **Gate check:** $X < T$ → **accept**.
- **Reduction:** $X \bmod 2^{128} = \texttt{0x67a201cb1b81a18f7f80000000000000}$.
- **Raw Entropy Hex:** `67a201cb1b81a18f7f80000000000000`
- **Checksum:** first 4 bits of $\text{SHA-256}(\text{entropy bytes})$, appended to form the 132-bit bitstream, split into twelve 11-bit chunks.
- **Generated Mnemonic:** `guilt avoid index damage borrow sibling wrap abandon abandon abandon abandon able`

### 11.b Reject Path

- **Roll sequence:** `6` repeated 55 times — the maximum possible roll sequence.
- **Digits:** `[5, 5, …, 5]`, giving $X = N - 1 = \texttt{0x48268756d0073182ef9be57fffffffffffff}$.
- **Gate check:** $X \ge T$ → **reject**. This sequence falls in the top $r$ outcomes ($\approx 1$ in 34,938 sequences at this tier — see Section 5.e) that cannot be mapped evenly across the 128-bit target space.
- **Result:** generation halts. No entropy, hex, or mnemonic is produced. The operator is instructed to clear all rolls and re-roll from scratch.

Both examples can be reproduced independently: build the BigInt from the digit sequence, compare against $T$, and — for the accept case — reduce mod $2^{128}$, hash with SHA-256, and slice into 11-bit BIP-39 word indices.

---

## Acknowledgements & References

- BIP-39: <https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki>
- Ian Coleman BIP39 tool: <https://iancoleman.io/bip39/>
- SHA-256, PBKDF2 specifications (NIST and RFC references)

 
