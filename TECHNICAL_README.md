# Technical & Cryptographic Specification

This document describes the information‑theoretic foundations, entropy bounds, framing pipeline, and security model of the `bip-39-dice` physical seed generator. It is intended as a precise, implementation‑level specification for reviewers and auditors.

---

## 1. Information‑Theoretic Foundations

### 1.1 Physical Entropy Source and Bernoulli Mapping
The physical entropy source is repeated independent rolls of a fair six‑sided die. For the purposes of estimating binary entropy, we map each roll to one bit using a simple partition:

- Roll ∈ {1, 2, 3} → 0
- Roll ∈ {4, 5, 6} → 1

Under the fair‑die assumption this produces independent and identically distributed (i.i.d.) Bernoulli trials with p = 0.5.

Shannon entropy per roll:

$$
H(X) = -\sum_{x \in \{0,1\}} P(X=x) \log_2 P(X=x)
     = -\bigl(0.5\log_2 0.5 + 0.5\log_2 0.5\bigr) = 1.00\ \text{bit/roll}.
$$

Min‑entropy per roll (worst‑case single‑trial predictability):

$$
H_{\infty}(X) = -\log_2\bigl(\max_x P(X=x)\bigr) = -\log_2(0.5) = 1.00\ \text{bit/roll}.
$$

Because Shannon entropy and min‑entropy are equal under p = 0.5, each mapped roll contributes one full bit of entropy in both average and worst‑case senses prior to software processing.

Note: This binary mapping is for entropy accounting and statistical analysis. The generator also supports base‑6 encoding of rolls (1→0, 2→1, …, 6→5) for constructing raw entropy by treating the roll sequence as a base‑6 integer; see the implementation for that conversion path.

---

## 2. Framing, Checksum and Word Slicing

### 2.1 Raw Entropy Lengths
BIP‑39 requires raw entropy lengths E that are multiples of 32 bits. Standard choices and corresponding checksum lengths are:

| Mnemonic Length | Raw Entropy E | Checksum bits CS = E / 32 | Total bits (E + CS) |
|---:|---:|---:|---:|
| 12 words | 128 | 4 | 132 |
| 15 words | 160 | 5 | 165 |
| 18 words | 192 | 6 | 198 |
| 21 words | 224 | 7 | 231 |
| 24 words | 256 | 8 | 264 |

### 2.2 Checksum Derivation (SHA‑256)
Compute the SHA‑256 digest over the raw entropy byte array as produced by the implementation (see Implementation notes on byte ordering):

$$\text{Digest} = \mathrm{SHA\mbox{-}256}(\mathrm{RawEntropy\_bytes}).$$

Take the first CS bits of the Digest as the checksum bits (that is, the most significant bits of the digest stream):

$$\text{Checksum} = \mathrm{Digest}[0 : CS - 1].$$

Concatenate the raw entropy bitstring and the checksum bits to form the full bitstream S of length L = E + CS.

Cryptographic note: SHA‑256 is used only to compute deterministic checksum bits; it does not increase the min‑entropy of the raw E‑bit sequence. The attacker's search space is bounded by 2^E.

### 2.3 11‑bit Word Indices
Partition S into contiguous 11‑bit chunks and interpret each chunk in MSB‑first order to produce the BIP‑39 word indices (this is the standard BIP‑39 interpretation). Formally, for k = 0, 1, …, (L/11) − 1:

$$W_k = \sum_{i=0}^{10} S[11k + i] \times 2^{10-i}\ ,$$

where W_k is the integer value of the k‑th 11‑bit block in MSB‑first bit ordering. Each W_k ∈ [0, 2047] indexes the BIP‑39 English wordlist.

Implementation caveat: the bitstream S is constructed from the raw entropy bytes using the implementation's byte ordering (LSB byte ordering when converting dice rolls to bytes). That means the sequence of bits in S may differ from a big‑endian construction of the same numeric value; the important invariant is consistency between: the displayed raw entropy hex, the computed checksum, and the generated mnemonic. For interoperability, always verify by pasting the displayed entropy hex into external tools (e.g., Ian Coleman) — the hex string is the canonical artifact to compare.

---

## 3. Empirical vs. Theoretical Min‑Entropy

Short sample sizes and the chosen measurement resolution can create apparent reductions in empirical min‑entropy that do not reflect a true loss of cryptographic strength.

### 3.1 Single‑Bit Variance Example (160 bits)
A uniformly random 160‑bit string has expected number of ones

$$\mu = 160 \times 0.5 = 80$$

and standard deviation

$$\sigma = \sqrt{160 \times 0.5 \times 0.5} = \sqrt{40} \approx 6.3246.$$

Observing 82 ones corresponds to z = (82 − 80)/σ ≈ 0.316, well within typical statistical fluctuation and not evidence of reduced entropy.

### 3.2 Byte‑Level Sampling Artifacts
When viewing N = 20 bytes (160 bits) as 8‑bit symbols, the maximum empirical frequency for a distinct byte value is 1/20 = 0.05 if all bytes are distinct. A naive calculation using that per‑byte frequency yields a low bound on empirical min‑entropy at the byte resolution; however, this is an artefact of the coarse (8‑bit symbol) sampling and small N. The true bitwise security remains governed by E (for example, 2^160 for 160 bits).

Practical recommendation: use bitwise statistics or aggregate many samples before inferring entropy degradation.

---

## 4. Downstream Key‑Derivation Architecture

After generating and verifying the mnemonic, standard wallet software expands the mnemonic into a seed using PBKDF2‑HMAC‑SHA512 as specified by BIP‑39:

$$\mathrm{Seed} = \mathrm{PBKDF2\mbox{-}HMAC\mbox{-}SHA512}(\mathrm{Mnemonic},\ "mnemonic" \mathbin{\Vert} \mathrm{Passphrase},\ 2048,\ 512)$$

This KDF both stretches and mixes the mnemonic (and optional passphrase), producing 512 bits of master seed material used by downstream HD key derivation (BIP‑32, etc.). Because PBKDF2 is a pseudorandom function keyed by the mnemonic, it acts as a randomness extractor: small, non‑adversarial statistical biases in the input are reduced by the PRF construction.

Security note: the extracted seed's security cannot exceed the entropy in the original mnemonic; thus the dominant security parameter is the raw entropy length E.

---

## 5. Implementation & Interoperability Notes

- Byte/bit ordering: the implementation uses LSB (least‑significant‑byte) ordering when converting dice rolls (or base‑6 digit sequences) to a raw entropy byte array. Within each byte, bits are presented in the conventional MSB‑first bit order when forming the bitstream S for checksum and word slicing. In short: roll sequence → LSB-first bytes → bytes' bits read MSB‑first to form S. This hybrid choice was made for implementation simplicity and to match the original project's entropy hex output. Always rely on the displayed entropy hex for cross‑verification.
- Verification: when verifying with third‑party tools (e.g., Ian Coleman), paste the displayed raw entropy hex — this hex reflects the exact byte ordering used by the implementation. Re‑entering the raw dice rolls into tools that assume a different roll‑to‑byte ordering (MSB versus LSB) will produce a different entropy value; that is expected and does not indicate an error so long as the entropy hex matches.
- Alternative roll encodings (base‑6): supported. If you convert rolls to a big integer in base‑6, document whether the first roll is treated as the least‑significant digit or most‑significant digit — this project treats the first recorded roll as contributing to the least‑significant digit when using LSB mode.
- All deterministic cryptographic primitives should be called from well‑tested libraries (Web Crypto API in browsers, with a pure‑JS fallback only for audited offline use).

---

## 6. Worked Example — 12 words (LSB mode, trivial)

This worked example demonstrates how a recorded dice sequence maps to raw entropy hex and a BIP‑39 mnemonic under the project's LSB ordering. For clarity we previously used the all‑zero entropy example which is canonical.

Steps (trivial):

1. Dice rolls (example): 128 rolls of "1" (i.e., all rolls in {1,2,3}) produce 128 zero bits under the 1→0,2→0,3→0,4→1,5→1,6→1 mapping.
2. Raw entropy bytes (implementation LSB mode): the integer value 0 → 16 bytes of 0x00 → raw entropy hex:

   00000000000000000000000000000000

3. Checksum & concatenation: compute SHA‑256 over the raw entropy bytes and take the first CS = 4 bits (for 12 words). Concatenate to form the 132‑bit stream S.

4. Word indices and mnemonic: splitting S into 11‑bit words and mapping to the BIP‑39 English wordlist produces the standard BIP‑39 test vector mnemonic for the all‑zero entropy:

   "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

5. Verification (recommended): paste the raw entropy hex above into Ian Coleman's BIP‑39 tool and confirm the mnemonic matches.

---

## 7. Worked Example — 12 words (LSB mode, non‑trivial)

Below is a compact, non‑trivial example that exercises the LSB conversion path. This example intentionally uses a small numeric value to keep intermediate representations short and human‑readable while still demonstrating the full pipeline.

Example parameters:
- Target: 12‑word mnemonic (E = 128 bits, 16 bytes)
- Rolls recorded (LSB ordering): 50 rolls (first recorded roll is least‑significant base‑6 digit)

Roll sequence (first = LSB):

1. 4, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
2. 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
3. 1, 1, 1, 1, 1, 1, 1, 1, 1, 1

Explanation:
- Map rolls to base‑6 digits (digit = roll − 1). The first two rolls produce digits [3, 2], all remaining rolls produce digit 0.
- Base‑6 integer value (N):

  N = 3 * 6^0 + 2 * 6^1 + 0 * 6^2 + ... + 0 * 6^49 = 3 + 12 = 15

- Convert N to a 16‑byte little‑endian byte array (LSB‑first bytes). The 128‑bit representation with little‑endian byte ordering is:

  Bytes (hex, LSB first): 0f 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00

  Displayed raw entropy hex (implementation shows bytes in LSB byte order):

  0f000000000000000000000000000000

- Checksum: compute Digest = SHA‑256(raw_entropy_bytes). Take the first CS = 4 bits of Digest as the checksum and append to the 128‑bit raw entropy to form the 132‑bit stream S.

- Word indices: split S into 11‑bit MSB‑first chunks and map each integer to the BIP‑39 English wordlist to obtain the 12 mnemonic words.

Practical verification (recommended):
1. Using the raw entropy hex above (0f0000...00), paste it into Ian Coleman's BIP‑39 tool (or use a local SHA‑256 + bit‑slice script) and confirm the resulting 12‑word mnemonic. The implementation will display the same raw entropy hex and mnemonic; match both to verify correctness.

Notes on this example:
- This example uses a low numeric value (N = 15) for readability. In practice, use full‑entropy roll sequences (≈50 dice rolls for 12 words) with high variance.
- The key point is the pipeline: recorded rolls → base‑6 digits (LSB) → little‑endian byte array → raw entropy hex → SHA‑256 checksum → 11‑bit indexes → mnemonic.

---

## Acknowledgements & References

- BIP‑39: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- Ian Coleman BIP39 tool: https://iancoleman.io/bip39/
- SHA‑256, PBKDF2 specifications (NIST and RFC references)
