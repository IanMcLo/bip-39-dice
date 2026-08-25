# Technical & Cryptographic Specification

This document describes the information-theoretic foundations, entropy bounds, framing pipeline, and security model of the `bip-39-dice` physical seed generator. It is intended as a precise, implementable reference for auditors and advanced users.

---

## 1. Information-Theoretic Foundations

### 1.1 Physical Entropy Source and Bernoulli Mapping

The physical entropy source is repeated independent rolls of a fair six-sided die. For the purposes of estimating binary entropy, we map each roll to one bit using a simple partition:

- $\text{Roll} \in \{1, 2, 3\} \to 0$
- $\text{Roll} \in \{4, 5, 6\} \to 1$

Under the fair-die assumption this produces independent and identically distributed (i.i.d.) Bernoulli trials with $p = 0.5$.

Shannon entropy per roll:

$$H(X) = -\sum_{x \in \{0,1\}} P(X=x) \log_2 P(X=x) = -(0.5 \log_2 0.5 + 0.5 \log_2 0.5) = 1.00 \text{ bit/roll}$$

Min-entropy per roll (worst-case single-trial predictability):

$$H_\infty(X) = -\log_2\left(\max_x P(X=x)\right) = -\log_2(0.5) = 1.00 \text{ bit/roll}$$

Because Shannon entropy and min-entropy are equal under p = 0.5, each mapped roll contributes one full bit of entropy in both average and worst-case senses prior to software processing.

Note: This binary mapping is for entropy accounting and statistical analysis. The generator also supports base-6 encoding of rolls (1→0, 2→1, …, 6→5) for constructing raw entropy by treating runs of rolls as base-6 digits and converting to a fixed-length byte array.

---

## 2. Framing, Checksum and Word Slicing

### 2.1 Raw Entropy Lengths

BIP-39 requires raw entropy lengths E that are multiples of 32 bits. Standard choices and corresponding checksum lengths are:

| Mnemonic Length | Raw Entropy $E$ | Checksum bits $CS = E / 32$ | Total bits ($E + CS$) |
|---|---|---|---|
| 12 words | 128 | 4 | 132 |
| 15 words | 160 | 5 | 165 |
| 18 words | 192 | 6 | 198 |
| 21 words | 224 | 7 | 231 |
| 24 words | 256 | 8 | 264 |

### 2.2 Checksum Derivation (SHA-256)

Compute the SHA-256 digest over the raw entropy byte array as produced by the implementation (see Implementation notes on byte ordering):

$$\text{Digest} = \text{SHA-256}(\text{RawEntropy\_bytes})$$

Take the first $CS$ bits of the Digest as the checksum bits (that is, the most significant bits of the digest stream):

$$\text{Checksum} = \text{Digest}[0 : CS - 1]$$

Concatenate the raw entropy bitstring and the checksum bits to form the full bitstream $S$ of length $L = E + CS$.

Cryptographic note: SHA-256 is used only to compute deterministic checksum bits; it does not increase the min-entropy of the raw $E$-bit sequence. The attacker's search space is bounded by $2^E$.

### 2.3 11-bit Word Indices

Partition $S$ into contiguous 11-bit chunks and interpret each chunk in MSB-first order to produce the BIP-39 word indices (this is the standard BIP-39 interpretation). Formally, for $k = 0, 1, \ldots$:

$$W_k = \sum_{i=0}^{10} S[11k + i] \times 2^{10-i}$$

where $W_k$ is the integer value of the $k$-th 11-bit block in MSB-first bit ordering. Each $W_k \in [0, 2047]$ indexes the BIP-39 English wordlist.

Implementation caveat: the bitstream $S$ is constructed from the raw entropy bytes using the implementation's byte ordering. That means the sequence of bits used to form 11-bit words depends on how rolls are packed into bytes. Always verify using the displayed raw entropy hex.

---

## 3. Empirical vs. Theoretical Min-Entropy

Short sample sizes and the chosen measurement resolution can create apparent reductions in empirical min-entropy that do not reflect a true loss of cryptographic strength.

### 3.1 Single-Bit Variance Example (160 bits)

A uniformly random 160-bit string has expected number of ones

$$\mu = 160 \times 0.5 = 80$$

and standard deviation

$$\sigma = \sqrt{160 \times 0.5 \times 0.5} = \sqrt{40} \approx 6.3246$$

Observing 82 ones corresponds to $z = (82 - 80)/\sigma \approx 0.316$, well within typical statistical fluctuation and not evidence of reduced entropy.

### 3.2 Byte-Level Sampling Artifacts

When viewing $N = 20$ bytes (160 bits) as 8-bit symbols, the maximum empirical frequency for a distinct byte value is $1/20 = 0.05$ if all bytes are distinct. A naive calculation using that per-byte frequency as if bytes were independent symbols can under-estimate entropy for short samples.

Practical recommendation: use bitwise statistics or aggregate many samples before inferring entropy degradation.

---

## 4. Downstream Key-Derivation Architecture

After generating and verifying the mnemonic, standard wallet software expands the mnemonic into a seed using PBKDF2-HMAC-SHA512 as specified by BIP-39:

$$\text{Seed} = \text{PBKDF2-HMAC-SHA512}(\text{Mnemonic},\ \text{"mnemonic"} \parallel \text{Passphrase},\ 2048,\ 512)$$

This KDF both stretches and mixes the mnemonic (and optional passphrase), producing 512 bits of master seed material used by downstream HD key derivation (BIP-32, etc.). Because PBKDF2 is a pseudorandom function keyed by the mnemonic, it acts as a randomness extractor: small, non-adversarial statistical biases in the input are reduced by the PRF construction.

Security note: the extracted seed's security cannot exceed the entropy in the original mnemonic; thus the dominant security parameter is the raw entropy length $E$.

---

## 5. Bounded Rejection Sampling: Eliminating Modulo Bias Exactly

Modulo bias occurs when a total number of outcomes ($N$) is mapped into a target range ($R$) via a modulo operation, and $N$ is not perfectly divisible by $R$. This leaves some outcomes with a slightly higher probability of appearing than others.

An earlier version of this tool mitigated bias purely through over-sampling: gathering more raw entropy than needed and accepting that a small residual bias remained mathematically negligible. **The current implementation goes further and eliminates the bias entirely** by rejecting any roll sequence that would land in the biased zone, rather than accepting it.

### a. Defining the Spaces

Let $k$ be the number of dice rolls. The total number of unique base‑6 outcomes is:

$$N = 6^k$$

Let $b$ be the target number of bits (e.g., 128 bits for 12 words, 256 bits for 24 words). The target range of the output space is:

$$R = 2^b$$

Because $6^k$ is never a perfect power of 2, mapping $N$ outcomes onto $R$ buckets can never be perfectly even. Let $q = \lfloor N/R \rfloor$ and $r = N \bmod R$. Then $r$ buckets would receive $q+1$ values and $R-r$ buckets would receive $q$ values under naive modulo reduction — this is the source of the bias.

### b. The Rejection Boundary

Define the **uniformity boundary**:

$$T = N - r = N - (N \bmod R)$$

$T$ is the largest multiple of $R$ that is $\le N$. Let $X$ be the integer formed by treating the dice rolls as base-6 digits (first roll = most significant digit, digit = roll − 1).

- **If $X \ge T$** (the roll sequence fell into the biased remainder zone): **reject**. The tool refuses to generate and asks the operator to clear the input and re-roll.
- **If $X < T$**: **accept**. Compute the output as $X \bmod R$.

Because every accepted output is drawn from an integer range of exactly $T$, which is by construction an exact multiple of $R$, **every one of the $R$ output buckets receives exactly $T/R$ accepted inputs — mapping is perfectly uniform over the target range whenever a sequence is accepted.** There is no residual bias to bound; the bias is removed by construction, not merely made small.

### c. Rejection Probability Per Tier

The rejection probability $P(\text{reject}) = r/N$ depends only on the roll count $k$ and target bits $b$ — not on the specific dice values rolled — so it is a fixed, exactly computable quantity for each tier, not an estimate:

| Words | Rolls ($k$) | Target ($b$) | Raw bits $H = k\log_2 6$ | Buffer ($H-b$) | Exact $P(\text{reject}) = r/N$ |
|---|---|---|---|---|---|
| 12 | 55 | 128 | 142.173 | 14.173 | 0.002862% (1 in 34,938) |
| 15 | 66 | 160 | 170.608 | 10.608 | 0.01350% (1 in 7,409) |
| 18 | 79 | 192 | 204.212 | 12.212 | 0.01035% (1 in 9,666) |
| 21 | 92 | 224 | 237.817 | 13.817 | 0.004599% (1 in 21,743) |
| 24 | 105 | 256 | 271.421 | 15.421 | 0.001167% (1 in 85,691) |

Note: $R/N = 2^{-\text{buffer}}$ is the standard *worst-case upper bound* on $P(\text{reject})$ (equivalently, the bound used in the older over-sampling analysis, $\Delta(P,U) \le R/2N$). The exact value $r/N$ shown above is always at or below that bound — in practice roughly half of it — because $r$ is not, in general, equal to $R$. Either figure is small enough to be operationally negligible; on rejection, simply clear the input and re-roll the full sequence.

---

## 6. Why $X \bmod R$ (Keeping the Low-Order Bits) Is the Correct Reduction

Once a roll sequence is accepted (Section 5b), the raw entropy is computed as $X \bmod R$, equivalently expressed as retaining only the low-order $b$ bits of $X$'s binary representation (or, in hex form, the low-order $b/4$ hex characters of $X$'s full hex expansion, left-padded with zeros to the required length if $X$ is short).

This is mathematically sound independent of the rejection step:

- The high-order bits of $X$ are disproportionately influenced by the earliest rolls and by which multiple-of-$R$ block $X$ falls into — this is exactly the structure that produces bias if used directly.
- The low-order bits are the product of every roll's contribution compounding through repeated multiplication by 6 and are, for a uniformly-rolled $X$ in an accepted (sub-$T$) range, uniformly distributed over $[0, R)$.

Combined with Section 5's rejection gate, this reduction is exact rather than approximate: rejection guarantees the pre-reduction range is a clean multiple of $R$, and modulo reduction over a clean multiple of $R$ is provably uniform — not merely low-bias.

---

## 7. Implementation & Interoperability Notes

- **Byte/bit ordering:** The implementation treats the first recorded die roll as the most significant base-6 digit (MSB-first). The accumulated base-6 integer is reduced via bounded rejection sampling (Section 5) and the accepted result is converted to a big-endian hex string, zero-padded to the target byte length.

- **Rejection Sampling, Not Truncation:** Earlier versions of this document described a truncate-only strategy with an accepted residual bias. The shipped implementation instead performs the accept/reject test in Section 5 before reduction. On rejection, the UI raises `⛔ REJECTION SAMPLING TRIGGERED` and disables generation for that input; the operator must clear the field and re-roll.

- **Elevated Roll Counts:** Minimum roll counts (55 rolls for 12 words up to 105 rolls for 24 words — see the table in Section 5c) provide the raw-entropy buffer above the target bit length that keeps rejection rare across all tiers (worst case roughly 1 in 7,400).

- **Strict Input Validation:** The dice-roll input field accepts only digits 1–6 and optional whitespace. Any other character is flagged immediately as an error and disables generation rather than being silently discarded — this prevents a mistyped character from quietly changing the entropy input without the operator's knowledge.

- **Verification:** When verifying outputs with third-party tools (e.g., Ian Coleman), paste the displayed raw hex entropy. This hex reflects the exact byte ordering and rejection-sampling reduction used by the implementation. Re-entering raw dice rolls into tools that assume a different roll-to-byte ordering, a different rejection strategy, or lower roll counts will produce a different entropy value; this is expected and does not indicate an error so long as the entropy hex matches.

- **Cryptographic Primitives:** Mnemonic key derivation uses PBKDF2-HMAC-SHA512 per BIP-39 specifications. SHA-256 for wordlist verification is provided natively by `window.crypto.subtle` with a pure-JS fallback for offline `file://` access.

---

## 8. Threat Model & Operational Security

This section summarises the physical and operational assumptions made by the generator and gives concise guidance for safe use.

The generator stores the mnemonic and entropy in closure-scoped variables (not window globals) to prevent exposure to browser extensions or injected scripts.

- **Assumptions:** The generator assumes dice are rolled by an honest operator in a physically private environment and that the recording medium (paper or device) is under the operator's control during generation. The document does not assume the operator's environment is free of all risks — instead it documents mitigations for common physical threats.

- **Threats considered:** Shoulder-surfing or covert recording, biased or tampered dice, accidental leakage via networked devices, operator error when re-entering or transferring entropy/mnemonic data, and residual secret material left in the clipboard or in the Audit Terminal display after use.

- **Operational recommendations:**

  * Roll and record in private; remove cameras, disable microphones, and avoid network-connected devices in the immediate area while generating entropy.
  * Use standard, undamaged dice from a reliable source. If in doubt, perform quick chi-square checks on a sample of rolls or use multiple dice and aggregate results.
  * Prefer an air-gapped computer for converting rolls to entropy or use paper (and an offline reproducible script) to reduce attack surface. If a device is used, verify the binary or HTML artifact's checksums prior to use.
  * Do not paste raw entropy or the mnemonic into online web pages or networked tools. When verification against third-party tools is required, transfer only the raw entropy hex using an offline method (QR printed on paper, air-gap USB) and verify on an independent, air-gapped machine.
  * Treat raw entropy hex and the mnemonic as highly sensitive. The tool attempts to clear the clipboard automatically ~45 seconds after a Copy action, and immediately on "Clear Rolls" or "Hard Reset" — but this is a **best-effort clear, not a guaranteed secure erasure**: no web page can force the OS, other applications, or clipboard-sync services to forget a value once it has been written. Avoid copying to the clipboard on networked systems at all where practical, and clear and destroy intermediate paper records only after secure transfer if required.
  * The Modulo Bias Audit Terminal hides the sequence-derived values (the roll-derived integer and the modulus arithmetic tied to it) behind an explicit "Show advanced values" toggle, off by default, since those values are computed from the operator's actual dice rolls and leak partial information about the entropy being generated if left visible on screen or captured in a screenshot. Only enable this toggle briefly, for verification, in a private setting.

- **Out of scope:** Supply-chain compromises of cryptographic libraries, OS-level compromise of the recording device, and coercion attacks against the operator.

---

## 9. Common Pitfalls and How to Avoid Them

- **Re-typing dice rolls into other tools:** Always verify by using the displayed raw entropy hex rather than re-typing roll sequences into third-party tools.

- **Byte/bit ordering mismatch:** This project treats the first recorded roll as the most significant base-6 digit and outputs big-endian hex. Other tools may use different conventions, and may not implement rejection sampling at all. Use the displayed hex when cross-checking.

- **Confusing encodings:** Binary mapping (1–3 → 0, 4–6 → 1) used for bit accounting is distinct from base-6 digit mapping (digit = roll − 1). Ensure you use the correct mapping for the intended conversion path.

- **Insufficient sample size:** Collecting too few rolls produces noisy empirical statistics and may leave you short of required entropy. The UI enforces the current minimums: 55 rolls for 12 words, up to 105 rolls for 24 words (see Section 5c) — the tool will not allow generation below the required count for the selected tier.

- **Exposing the mnemonic:** Never paste the mnemonic into networked web pages. Use local, audited tools for any additional verification.

---

## 10. Trusted Code Base & Audit Checklist

For auditors and advanced users, verify the following before using this tool in a threat-sensitive workflow:

- Identify the implementation files for entropy collection and conversion (dice parsing, base-6 → BigInt, rejection-sampling gate, integer → byte array, checksum, and word slicing). Confirm these are the only code paths used during generation.

- Confirm the sources and versions of cryptographic primitives (Web Crypto API, and the name/version of any bundled pure-JS SHA-256 implementation). Prefer native, well-maintained libraries.

- Confirm the on-load self-test suite runs and fails closed: the wordlist SHA-256 hash, the four official BIP-39 known-answer vectors, and the rolls→entropy known-answer test should all pass before the Generate button is enabled. Deliberately corrupt one KAT locally and confirm generation is blocked.

- Specify acceptable runtime environments (e.g., offline browser via file://, Node.js in an air-gapped machine) and document any environment caveats.

- Reproducible builds: publish artifact checksums and provide build instructions so auditors can reproduce release artifacts and verify integrity.

Suggested audit checklist:

- Confirm the implementation files for dice → entropy → hex → mnemonic and list their paths.
- Confirm SHA-256 and PBKDF2 implementations and their origins/versions.
- Confirm the rejection-sampling boundary ($T = N - (N \bmod R)$) is computed and enforced before any modulo reduction, and that rejection surfaces a visible error rather than silently reducing entropy.
- Reproduce the worked example in Section 11 in an air-gapped environment using the provided build.
- Verify there are no network calls, telemetry, or remote loading in the artifact used for generation.
- Verify release artifact checksums/signatures.

---

## 11. Worked Example — 12 words (55 rolls)

This worked example demonstrates how a 55-roll sequence maps to raw entropy hex and a BIP-39 mnemonic under the current bounded-rejection-sampling implementation. These figures are the tool's own verified Known Answer Test (`ROLLS_KAT`) and reproduce exactly on every page load.

### Example Parameters

- **Target Mnemonic:** 12 words ($b = 128$ bits, 16 bytes)
- **Roll Sequence:** 55 rolls (`4, 3` followed by 53 rolls of `1`)

### Step-by-Step Conversion

1. **Map Rolls to Base-6 Digits ($\text{digit} = \text{roll} - 1$):**

   - First two rolls (`4, 3`): digits `[3, 2]`
   - Remaining 53 rolls (`1`): digits `[0, 0, ..., 0]`

2. **Calculate the Base-6 BigInt ($X$) and the Rejection Boundary:**

   $$N = 6^{55} = 6{,}285{,}195{,}213{,}566{,}005{,}335{,}561{,}053{,}533{,}150{,}026{,}217{,}291{,}776$$
   $$R = 2^{128} = 340{,}282{,}366{,}920{,}938{,}463{,}463{,}374{,}607{,}431{,}768{,}211{,}456$$
   $$r = N \bmod R = 179{,}896{,}536{,}271{,}915{,}392{,}524{,}533{,}885{,}267{,}351{,}699{,}456$$
   $$T = N - r = 6{,}285{,}015{,}317{,}029{,}733{,}420{,}168{,}528{,}999{,}264{,}758{,}865{,}592{,}320$$
   $$X = 3{,}491{,}775{,}118{,}647{,}780{,}741{,}978{,}363{,}073{,}972{,}236{,}787{,}384{,}320$$

3. **Check the Rejection Condition:**

   $$X < T \implies \textbf{ACCEPT}$$

4. **Reduce via Modulo:**

   $$X \bmod R = 137{,}751{,}672{,}031{,}168{,}380{,}676{,}227{,}114{,}863{,}169{,}634{,}304$$

   **Raw Entropy Hex:** `67a201cb1b81a18f7f80000000000000`

5. **Checksum & Word Index Generation:**

   - Compute $\text{SHA-256}(\text{Raw Entropy})$ to extract the 4-bit checksum.
   - Append checksum to raw entropy to form the 132-bit bitstream $S$.
   - Split $S$ into 11-bit MSB-first chunks to map to BIP-39 English wordlist indices.

6. **Verification Output:**

   - **Raw Entropy Hex:** `67a201cb1b81a18f7f80000000000000`
   - **Generated Mnemonic:** `guilt avoid index damage borrow sibling wrap abandon abandon abandon abandon able`

This exact roll sequence, hex output, and mnemonic are checked automatically as part of the on-load self-test suite (Section 10) — if you reproduce a different result, the implementation you are auditing has diverged from this specification.

---

## Acknowledgements & References

- BIP-39: <https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki>
- Ian Coleman BIP39 tool: <https://iancoleman.io/bip39/>
- SHA-256, PBKDF2 specifications (NIST and RFC references)
