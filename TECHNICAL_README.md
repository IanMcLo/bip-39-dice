
# Technical & Cryptographic Specification

This document describes the information-theoretic foundations, entropy bounds, framing pipeline, and security model of the `bip-39-dice` physical seed generator. It is intended as a precise, implementable reference for auditors and advanced users.

---

## 1. Information-Theoretic Foundations

### 1.1 Physical Entropy Source and Bernoulli Mapping

The physical entropy source is repeated independent rolls of a fair six-sided die. For the purposes of estimating binary entropy, we map each roll to one bit using a simple partition:

- Roll ∈ {1, 2, 3} → 0
- Roll ∈ {4, 5, 6} → 1

Under the fair-die assumption this produces independent and identically distributed (i.i.d.) Bernoulli trials with p = 0.5.

Shannon entropy per roll:

$$H(X) = -\sum_{x \in \{0,1\}} P(X=x)\log_2 P(X=x) = 1.00 \text{ bit/roll}$$ 

Min-entropy per roll (worst-case single-trial predictability):

$$H_{\infty}(X) = -\log_2\left(\max_x P(X=x)\right) = 1.00 \text{ bit/roll}$$

Because Shannon entropy and min-entropy are equal under p = 0.5, each mapped roll contributes one full bit of entropy in both average and worst-case senses prior to software processing.

Note: This binary mapping is for entropy accounting and statistical analysis. The generator also supports base-6 encoding of rolls (1→0, 2→1, …, 6→5) for constructing raw entropy by treating runs of rolls as base-6 digits and converting to a fixed-length byte array.

---

## 2. Framing, Checksum and Word Slicing

### 2.1 Raw Entropy Lengths

BIP-39 requires raw entropy lengths E that are multiples of 32 bits. Standard choices and corresponding checksum lengths are:

Mnemonic Length | Raw Entropy E | Checksum bits CS = E / 32 | Total bits (E + CS)
12 words | 128 | 4 | 132
15 words | 160 | 5 | 165
18 words | 192 | 6 | 198
21 words | 224 | 7 | 231
24 words | 256 | 8 | 264

### 2.2 Checksum Derivation (SHA-256)

Compute the SHA-256 digest over the raw entropy byte array as produced by the implementation (see Implementation notes on byte ordering):

$$\text{Digest} = \text{SHA-256}(\text{RawEntropy}_{bytes})$$

Take the first CS bits of the Digest as the checksum bits (that is, the most significant bits of the digest stream):

$$\text{Checksum} = \text{Digest}[0 : CS-1]$$

Concatenate the raw entropy bitstring and the checksum bits to form the full bitstream S of length L = E + CS.

Cryptographic note: SHA-256 is used only to compute deterministic checksum bits; it does not increase the min-entropy of the raw E-bit sequence. The attacker's search space is bounded by $2^E$.

### 2.3 11-bit Word Indices

Partition S into contiguous 11-bit chunks and interpret each chunk in MSB-first order to produce the BIP-39 word indices (this is the standard BIP-39 interpretation). Formally, for k = 0, 1, …:

$$W_k = \sum_{i=0}^{10} S[11k+i] \times 2^{10-i},$$

where W_k is the integer value of the k-th 11-bit block in MSB-first bit ordering. Each W_k ∈ [0, 2047] indexes the BIP-39 English wordlist.

Implementation caveat: the bitstream S is constructed from the raw entropy bytes using the implementation's byte ordering. That means the sequence of bits used to form 11-bit words depends on how rolls are packed into bytes. Always verify using the displayed raw entropy hex.

---

## 3. Empirical vs. Theoretical Min-Entropy

Short sample sizes and the chosen measurement resolution can create apparent reductions in empirical min-entropy that do not reflect a true loss of cryptographic strength.

### 3.1 Single-Bit Variance Example (160 bits)

A uniformly random 160-bit string has expected number of ones

$$\mu = 160\times 0.5 = 80$$

and standard deviation

$$\sigma = \sqrt{160 \times 0.5 \times 0.5} = \sqrt{40} \approx 6.3246$$

Observing 82 ones corresponds to z = (82 - 80)/sigma ≈ 0.316, well within typical statistical fluctuation and not evidence of reduced entropy.

### 3.2 Byte-Level Sampling Artifacts

When viewing N = 20 bytes (160 bits) as 8-bit symbols, the maximum empirical frequency for a distinct byte value is 1/20 = 0.05 if all bytes are distinct. A naive calculation using that per-byte frequency as if bytes were independent symbols can under-estimate entropy for short samples.

Practical recommendation: use bitwise statistics or aggregate many samples before inferring entropy degradation.

---

## 4. Downstream Key-Derivation Architecture

After generating and verifying the mnemonic, standard wallet software expands the mnemonic into a seed using PBKDF2-HMAC-SHA512 as specified by BIP-39:

$$\text{Seed} = \text{PBKDF2-HMAC-SHA512}(\text{Mnemonic}, \text{"mnemonic"} \,\|\, \text{Passphrase}, 2048, 512)$$

This KDF both stretches and mixes the mnemonic (and optional passphrase), producing 512 bits of master seed material used by downstream HD key derivation (BIP-32, etc.). Because PBKDF2 is a pseudorandom function keyed by the mnemonic, it acts as a randomness extractor: small, non-adversarial statistical biases in the input are reduced by the PRF construction.

Security note: the extracted seed's security cannot exceed the entropy in the original mnemonic; thus the dominant security parameter is the raw entropy length E.

---

## 5. Proving Over-Sampling Eliminates Modulo Bias

To prove how over-sampling eliminates modulo bias, we analyze the mapping of a large base‑6 integer space onto a smaller base‑2 target space.

Modulo bias occurs when a total number of outcomes ($N$) is mapped into a target range ($R$) via a modulo operation, and $N$ is not perfectly divisible by $R$. This leaves some outcomes with a slightly higher probability of appearing than others.

Here is the step-by-step mathematical proof demonstrating that a 5–8 bit over‑sampling buffer reduces this bias to safe, cryptographically negligible levels.



## a. Defining the Spaces and the Bias Formula

Let $k$ be the number of dice rolls. The total number of unique base‑6 outcomes is:

$$N = 6^k$$

Let $b$ be the target number of bits (e.g., 128 bits for 12 words, 256 bits for 24 words). The target range of the output space is:

$$R = 2^b$$

When we convert the base‑6 pool to the target byte length, we map $N$ outcomes into $R$ buckets. Because $6^k$ is never a perfect power of 2, the outcomes cannot be distributed perfectly equally.

Let $q = \lfloor N/R \rfloor$ and $r = N \bmod R$.  
Then $r$ buckets contain $q+1$ values, and $R-r$ buckets contain $q$ values.

The absolute probability difference (the bias $\epsilon$) between the most favored bucket and the least favored bucket is:

$$\epsilon = \frac{\lceil N/R \rceil - \lfloor N/R \rfloor}{N} = \frac{1}{N} = \frac{1}{6^k}$$

While $\epsilon$ is the individual item bias, the total statistical distance (Total Variation Distance) between our biased distribution $P$ and a perfectly uniform distribution $U$ over the target space $R$ is bounded by:

$$\Delta(P, U) \le \frac{R}{2N} = \frac{2^b}{2 \cdot 6^k}$$



## b. Quantifying the Safety Buffer (Entropy Over‑sampling)

To measure how much "extra" entropy we are gathering, we calculate the raw bit‑equivalent entropy of $k$ dice rolls using Shannon entropy for independent, uniform rolls:

$$H = \log_2(6^k) = k \cdot \log_2(6) \approx k \cdot 2.58496 \text{ bits}$$

The safety buffer $\text{Buffer}_{\text{bits}}$ is the difference between our raw entropy and our target bits:

$$\text{Buffer}_{\text{bits}} = H - b = (k \cdot \log_2(6)) - b$$



## c. Proof by Case Analysis (12 Words & 24 Words)

Plugging in the exact UI specifications into these formulas gives the exact numbers.

### Case (i): 12‑Word Mnemonic ($b = 128$ bits)

- Target: 128 bits ($2^{128}$)
- Rolls ($k$): 54 rolls
- Raw outcomes ($N$): $6^{54} \approx 2.407 \times 10^{42}$

Calculate the bit equivalent and the exact buffer:

$$\text{Bit Equivalent} = 54 \cdot \log_2(6) \approx 54 \cdot 2.5849625 = 139.588 \text{ bits}$$

$$\text{Buffer}_{\text{bits}} = 139.588 - 128 = \mathbf{11.588 \text{ bits}}$$


Now calculate the Total Variation Distance (bias upper bound):

$$\Delta(P, U) \le \frac{2^{128}}{2 \cdot 6^{54}} = \frac{2^{128}}{2 \cdot 2^{139.588}} = \frac{2^{128}}{2^{140.588}} = 2^{-12.588} \approx \mathbf{1.62 \times 10^{-4}}$$

An attacker trying to exploit this bias gains an advantage of less than 1 in 6,100 over a perfectly random 128‑bit pool. Because the baseline security of 128 bits is already astronomically high, a variation of $2^{-12.588}$ provides no exploitable mathematical edge.



### Case (ii): 24‑Word Mnemonic ($b = 256$ bits)

- Target: 256 bits ($2^{256}$)
- Rolls ($k$): 104 rolls
- Raw outcomes ($N$): $6^{104}$

Calculate the bit equivalent and the buffer:

$$\text{Bit Equivalent} = 104 \cdot \log_2(6) \approx 104 \cdot 2.5849625 = 268.836 \text{ bits}$$

$$\text{Buffer}_{\text{bits}} = 268.836 - 256 = \mathbf{12.836 \text{ bits}}$$

Now look at the Total Variation Distance for the 24‑word tier:

$$\Delta(P, U) \le \frac{2^{256}}{2 \cdot 6^{104}} = \frac{2^{256}}{2 \cdot 2^{268.836}} = \frac{2^{256}}{2^{269.836}} = 2^{-13.836} \approx \mathbf{6.73 \times 10^{-5}}$$

For a 256‑bit target, the bias is squeezed down to approximately 1 in 14,800. In cryptography, an advantage this small against an output space of $2^{256}$ is considered entirely negligible.

---
## 6. Why Keeping the Low-Order Characters (Trimming Left) is Mathematically Sound

The specification requires keeping the lower‑order characters via `hex.slice(-requiredHexLen)`.

In base‑6 to base‑16 conversion:

- The leftmost digits (MSB) of the resulting hex string are heavily dictated by the earliest dice rolls. If the total pool size $N$ doesn't cleanly align with $R$, the biased "remainder" clipping naturally distorts the distribution of the highest‑order bits.
- The rightmost digits (LSB) represent the rapid, high‑frequency oscillations of the base‑6 integer accumulation. Because the final dice rolls $(k-2, k-1, k)$ directly flip these lowest bits back and forth across every single integer increment, the lower‑order hex characters maintain an evenly distributed chaotic spread.

Mathematically, keeping only the lower‑order hex digits is exactly the same as taking:

$$X \bmod 2^b$$

where $X$ is the integer formed by the base‑6 dice outcomes.  

By discarding the excess bits from the left, we are effectively pushing the mathematical remainder of the imperfect $6^k \to 2^b$ mapping into the discarded high‑order zone, preserving the highly uniform distribution of the lower‑order bits.

---

## 7. Implementation & Interoperability Notes

* **Byte/bit ordering & Modulo Bias Mitigation:** The implementation treats the first recorded die roll as the most significant base-6 digit (MSB-first). The accumulated base-6 integer is converted directly to a big-endian hex string. Elevated roll counts (54 rolls for 12 words up to 104 rolls for 24 words) ensure the raw entropy pool ($6^N$) comfortably exceeds 2^target_bits providing an extra **~11–13 bits** of safety buffer that reduces modulo bias to negligible levels.

* **Hex Slicing & Precision:** Once the base-6 integer is converted to a hexadecimal string, it is formatted to the exact target byte length ($2 \times \text{requiredBytes}$). If the raw hex output exceeds the required byte precision, **lower-order hex characters are retained** (`hex.slice(-requiredHexLen)`) — trimming excess from the left — to preserve the entropy contributed by the final rolls. Shorter outputs are left-padded with zeros.

* **Input Locking & UX Boundaries:** To guarantee precise entropy boundaries and reproducible hashes across tools, the UI enforces strict input locking upon reaching the exact target roll count (54, 65, 78, 91, or 104 rolls). Keystrokes are capped at the target, and pasted strings are automatically truncated to match the exact requirement for the selected word tier.

* **Verification:** When verifying outputs with third-party tools (e.g., Ian Coleman), paste the displayed raw hex entropy. This hex reflects the exact byte ordering used by the implementation. Re-entering raw dice rolls into tools that assume a different roll-to-byte ordering or lower roll counts will produce a different entropy value; this is expected and does not indicate an error so long as the entropy hex matches.

* **Cryptographic Primitives:** Mnemonic key derivation uses PBKDF2-HMAC-SHA512 per BIP-39 specifications. SHA-256 for wordlist verification is provided natively by `window.crypto.subtle` with a pure-JS fallback for offline `file://` access.

---

## 8. Threat Model & Operational Security

This section summarises the physical and operational assumptions made by the generator and gives concise guidance for safe use.

The generator stores the mnemonic and entropy in closure-scoped variables (not  window  globals) to prevent exposure to browser extensions or injected scripts.

- Assumptions: The generator assumes dice are rolled by an honest operator in a physically private environment and that the recording medium (paper or device) is under the operator's control during generation. The document does not assume the operator's environment is free of all risks — instead it documents mitigations for common physical threats.

- Threats considered: Shoulder-surfing or covert recording, biased or tampered dice, accidental leakage via networked devices, and operator error when re-entering or transferring entropy/mnemonic data.

- Operational recommendations:
  - Roll and record in private; remove cameras, disable microphones, and avoid network-connected devices in the immediate area while generating entropy.
  - Use standard, undamaged dice from a reliable source. If in doubt, perform quick chi-square checks on a sample of rolls or use multiple dice and aggregate results.
  - Prefer an air-gapped computer for converting rolls to entropy or use paper (and an offline reproducible script) to reduce attack surface. If a device is used, verify the binary or HTML artifact's checksums prior to use.
  - Do not paste raw entropy or the mnemonic into online web pages or networked tools. When verification against third-party tools is required, transfer only the raw entropy hex using an offline method (QR printed on paper, air-gap USB) and verify on an independent, air-gapped machine.
  - Treat raw entropy hex and the mnemonic as highly sensitive. Avoid copying them to clipboards on networked systems; clear and destroy intermediate paper records only after secure transfer if required.

- Out of scope: Supply-chain compromises of cryptographic libraries, OS-level compromise of the recording device, and coercion attacks against the operator.

---

## 9. Common Pitfalls and How to Avoid Them

- Re-typing dice rolls into other tools: Always verify by using the displayed raw entropy hex rather than re-typing roll sequences into third-party tools.

- Byte/bit ordering mismatch: This project treats the first recorded roll as the most significant base-6 digit and outputs big-endian hex. Other tools may use different conventions. Use the displayed hex when cross-checking.

- Confusing encodings: Binary mapping (1–3 → 0, 4–6 → 1) used for bit accounting is distinct from base-6 digit mapping (digit = roll − 1). Ensure you use the correct mapping for the intended conversion path.

- Insufficient sample size: Collecting too few rolls produces noisy empirical statistics and may leave you short of required entropy. For 12 words prefer 52 rolls (base-6) or 128 rolls if using the binary mapping.

- Exposing the mnemonic: Never paste the mnemonic into networked web pages. Use local, audited tools for any additional verification.

---

## 10. Trusted Code Base & Audit Checklist

For auditors and advanced users, verify the following before using this tool in a threat-sensitive workflow:

- Identify the implementation files for entropy collection and conversion (dice parsing, base-6 → big integer, integer → byte array, checksum, and word slicing). Confirm these are the only code paths used during generation.

- Confirm the sources and versions of cryptographic primitives (Web Crypto API, and the name/version of any bundled pure-JS SHA-256 implementation). Prefer native, well-maintained libraries.

- Specify acceptable runtime environments (e.g., offline browser via file://, Node.js in an air-gapped machine) and document any environment caveats.

- Reproducible builds: publish artifact checksums and provide build instructions so auditors can reproduce release artifacts and verify integrity.

Suggested audit checklist:

- Confirm the implementation files for dice → entropy → hex → mnemonic and list their paths.
- Confirm SHA-256 and PBKDF2 implementations and their origins/versions.
- Reproduce the worked examples in an air-gapped environment using the provided build.
- Verify there are no network calls, telemetry, or remote loading in the artifact used for generation.
- Verify release artifact checksums/signatures.

---
## 11. Worked Example — 12 words (54 rolls)

This worked example demonstrates how a 54-roll sequence maps to raw entropy hex and a BIP-39 mnemonic under the v1.1.0 base-6 BigInt ordering.

### Example Parameters
* **Target Mnemonic:** 12 words ($E = 128 \text{ bits}$, 16 bytes)
* **Roll Sequence:** 54 rolls (`4, 3` followed by 52 rolls of `1`)


### Step-by-Step Conversion

1. **Map Rolls to Base-6 Digits ($\text{digit} = \text{roll} - 1$):**
   * First two rolls (`4, 3`): digits `[3, 2]`
   * Remaining 52 rolls (`1`): digits `[0, 0, ..., 0]`

2. **Calculate Base-6 BigInt ($N$):**
   $$N = 3 \times 6^{53} + 2 \times 6^{52} =  581,962,519,774,630,123,663,060,512,328,706,131,230,720$$
   $$\text{Unpadded Hex Output} = \text{0x6ae3bf055a1d9eaf0429540000000000000}
\text{ (35 hex characters)}$$


4. **Format & Trim to Target Byte Precision:**
   * Target length for 12 words: 16 bytes (32 hex characters).
   * Taking `slice(-32)` retains the 32 least significant hex characters:
   $$\text{Raw Entropy Hex} = \text{3bf055a1d9eaf0429540000000000000}$$

5. **Checksum & Word Index Generation:**
   * Compute $\text{SHA-256}(\text{Raw Entropy})$ to extract the 4-bit checksum.
   * Append checksum to raw entropy to form the 132-bit bitstream $S$.
   * Split $S$ into 11-bit MSB-first chunks to map to BIP-39 English wordlist indices.

6. **Verification Output:**
   * **Raw Entropy Hex:** `3bf055a1d9eaf0429540000000000000`
   * **Generated Mnemonic:** `desk live half record pyramid candy fence abandon abandon abandon abandon acid`

---

## Acknowledgements & References

- BIP-39: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- Ian Coleman BIP39 tool: https://iancoleman.io/bip39/
- SHA-256, PBKDF2 specifications (NIST and RFC references)
