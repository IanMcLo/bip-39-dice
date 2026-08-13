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
Compute the SHA‑256 digest over the raw entropy byte array (big‑endian byte order for the digest computation as usual):

$$\text{Digest} = \mathrm{SHA\mbox{-}256}(\mathrm{RawEntropy\_bytes}).$$

Take the first CS bits of the Digest as the checksum bits (that is, the most significant bits of the digest stream):

$$\text{Checksum} = \mathrm{Digest}[0 : CS - 1].$$

Concatenate the raw entropy bitstring and the checksum bits to form the full bitstream S of length L = E + CS.

Cryptographic note: SHA‑256 is used only to compute deterministic checksum bits; it does not increase the min‑entropy of the raw E‑bit sequence. The attacker's search space is bounded by 2^E.

### 2.3 11‑bit Word Indices
Partition S into contiguous 11‑bit chunks (most‑significant‑bit first within S):

For k = 0, 1, …, (L/11) − 1,

$$W_k = \sum_{i=0}^{10} S[11k + i] \times 2^{10-i}\ ,$$

where W_k is the integer value of the k‑th 11‑bit block in big‑endian bit ordering. Each W_k ∈ [0, 2047] indexes the BIP‑39 English wordlist.

(Equivalently: split S into 11‑bit words, interpret each 11‑bit block as an unsigned integer using MSB‑first bit ordering.)

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

- Byte ordering: this specification uses big‑endian ordering for digest and bitstream interpretation when constructing the checksum and 11‑bit blocks. The implementation documents the exact byte and bit ordering used; verify when cross‑checking with third‑party tools.
- Alternative roll encodings (base‑6) are supported: when rolls are encoded as base‑6 digits and converted to bytes, ensure the same endian interpretation is used when verifying entropy hex with external tools.
- All deterministic cryptographic primitives should be called from well‑tested libraries (Web Crypto API in browsers, with a pure‑JS fallback only for audited offline use).

---

## Acknowledgements & References

- BIP‑39: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- Ian Coleman BIP39 tool: https://iancoleman.io/bip39/
- SHA‑256, PBKDF2 specifications (NIST and RFC references)
