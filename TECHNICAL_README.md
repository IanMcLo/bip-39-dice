
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

H(X) = -sum_{x in {0,1}} P(X=x) log2 P(X=x) = -(0.5 log2 0.5 + 0.5 log2 0.5) = 1.00 bit/roll.

Min-entropy per roll (worst-case single-trial predictability):

H_infinity(X) = -log2(max_x P(X=x)) = -log2(0.5) = 1.00 bit/roll.

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

Digest = SHA-256(RawEntropy_bytes).

Take the first CS bits of the Digest as the checksum bits (that is, the most significant bits of the digest stream):

Checksum = Digest[0 : CS - 1].

Concatenate the raw entropy bitstring and the checksum bits to form the full bitstream S of length L = E + CS.

Cryptographic note: SHA-256 is used only to compute deterministic checksum bits; it does not increase the min-entropy of the raw E-bit sequence. The attacker's search space is bounded by 2^E.

### 2.3 11-bit Word Indices

Partition S into contiguous 11-bit chunks and interpret each chunk in MSB-first order to produce the BIP-39 word indices (this is the standard BIP-39 interpretation). Formally, for k = 0, 1, …:

W_k = sum_{i=0}^{10} S[11k + i] × 2^{10-i},

where W_k is the integer value of the k-th 11-bit block in MSB-first bit ordering. Each W_k ∈ [0, 2047] indexes the BIP-39 English wordlist.

Implementation caveat: the bitstream S is constructed from the raw entropy bytes using the implementation's byte ordering. That means the sequence of bits used to form 11-bit words depends on how rolls are packed into bytes. Always verify using the displayed raw entropy hex.

---

## 3. Empirical vs. Theoretical Min-Entropy

Short sample sizes and the chosen measurement resolution can create apparent reductions in empirical min-entropy that do not reflect a true loss of cryptographic strength.

### 3.1 Single-Bit Variance Example (160 bits)

A uniformly random 160-bit string has expected number of ones

mu = 160 × 0.5 = 80

and standard deviation

sigma = sqrt(160 × 0.5 × 0.5) = sqrt(40) ≈ 6.3246.

Observing 82 ones corresponds to z = (82 - 80)/sigma ≈ 0.316, well within typical statistical fluctuation and not evidence of reduced entropy.

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


## 5. Implementation & Interoperability Notes

* **Byte/bit ordering & Modulo Bias Mitigation:** The implementation treats the first recorded die roll as the most significant base-6 digit (MSB-first). The accumulated base-6 integer is converted directly to a big-endian hex string. Elevated roll counts (54 rolls for 12 words up to 104 rolls for 24 words) ensure the raw entropy pool ($6^N$) comfortably exceeds 2^target_bits providing an extra **~5–8 bits** of safety buffer that reduces modulo bias to negligible levels.

* **Hex Slicing & Precision:** Once the base-6 integer is converted to a hexadecimal string, it is formatted to the exact target byte length ($2 \times \text{requiredBytes}$). If the raw hex output exceeds the required byte precision, **lower-order hex characters are retained** (`hex.slice(-requiredHexLen)`) — trimming excess from the left — to preserve the entropy contributed by the final rolls. Shorter outputs are left-padded with zeros.

* **Input Locking & UX Boundaries:** To guarantee precise entropy boundaries and reproducible hashes across tools, the UI enforces strict input locking upon reaching the exact target roll count (54, 65, 78, 91, or 104 rolls). Keystrokes are capped at the target, and pasted strings are automatically truncated to match the exact requirement for the selected word tier.

* **Verification:** When verifying outputs with third-party tools (e.g., Ian Coleman), paste the displayed raw hex entropy. This hex reflects the exact byte ordering used by the implementation. Re-entering raw dice rolls into tools that assume a different roll-to-byte ordering or lower roll counts will produce a different entropy value; this is expected and does not indicate an error so long as the entropy hex matches.

* **Cryptographic Primitives:** Mnemonic key derivation uses PBKDF2-HMAC-SHA512 per BIP-39 specifications. SHA-256 for wordlist verification is provided natively by `window.crypto.subtle` with a pure-JS fallback for offline `file://` access.

---

## Threat Model & Operational Security

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

## Common Pitfalls and How to Avoid Them

- Re-typing dice rolls into other tools: Always verify by using the displayed raw entropy hex rather than re-typing roll sequences into third-party tools.

- Byte/bit ordering mismatch: This project treats the first recorded roll as the most significant base-6 digit and outputs big-endian hex. Other tools may use different conventions. Use the displayed hex when cross-checking.

- Confusing encodings: Binary mapping (1–3 → 0, 4–6 → 1) used for bit accounting is distinct from base-6 digit mapping (digit = roll − 1). Ensure you use the correct mapping for the intended conversion path.

- Insufficient sample size: Collecting too few rolls produces noisy empirical statistics and may leave you short of required entropy. For 12 words prefer 52 rolls (base-6) or 128 rolls if using the binary mapping.

- Exposing the mnemonic: Never paste the mnemonic into networked web pages. Use local, audited tools for any additional verification.

---

## Trusted Code Base & Audit Checklist

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

## 6. Worked Example — 12 words (trivial)

This worked example demonstrates how a recorded dice sequence maps to raw entropy hex and a BIP-39 mnemonic under the project's ordering. For clarity we use the all-zero entropy example which is canonical.

Steps (trivial):

1. Dice rolls (example): 128 rolls of "1" (i.e., all rolls in {1,2,3}) produce 128 zero bits under the 1→0,2→0,3→0,4→1,5→1,6→1 mapping.

2. Raw entropy bytes: The integer value 0 → 16 bytes of 0x00 → raw entropy hex:

   00000000000000000000000000000000

3. Checksum & concatenation: Compute SHA-256 over the raw entropy bytes and take the first CS = 4 bits (for 12 words). Concatenate to form the 132-bit stream S.

4. Word indices and mnemonic: Splitting S into 11-bit words and mapping to the BIP-39 English wordlist produces the standard BIP-39 test vector mnemonic for the all-zero entropy:

   abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about

5. Verification (recommended): Paste the raw entropy hex above into Ian Coleman's BIP-39 tool and confirm the mnemonic matches.

---

## 7. Worked Example — 12 words (non-trivial)

Below is a compact, non-trivial example that exercises the actual conversion path. This example intentionally uses a small numeric value to keep intermediate representations short and human-readable.

Example parameters:
- Target: 12-word mnemonic (E = 128 bits, 16 bytes)
- Rolls recorded: 50 rolls

Roll sequence (first = most significant digit):

4, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
1, 1, 1, 1, 1, 1, 1, 1, 1, 1

Explanation:

- Map rolls to base-6 digits (digit = roll − 1). The first two rolls produce digits [3, 2]; all remaining rolls produce digit 0.

- Base-6 integer value (N), with the first roll as the most significant digit:

  N = 3·6^49 + 2·6^48
  N = 449045154147091144801744222475853496320 (decimal)
  N = 151d2f36c91bf96b43314000000000000 (hex, 33 chars)

- The implementation requires exactly 16 bytes (32 hex characters). The full hex is 33 characters, so the leftmost character (1) is trimmed:

  Raw entropy hex: 51d2f36c91bf96b43314000000000000

- Checksum: Compute Digest = SHA-256(raw_entropy_bytes). Take the first CS = 4 bits of Digest as the checksum and append to the 128-bit raw entropy to form the 132-bit stream S.

- Word indices: Split S into 11-bit MSB-first chunks and map each integer to the BIP-39 English wordlist:

  fade nurse swamp casino west foam slush length abandon abandon abandon abuse

Practical verification (recommended):

1. Paste the raw entropy hex 51d2f36c91bf96b43314000000000000 into Ian Coleman's BIP-39 tool (or use a local SHA-256 + bit-slice script) and confirm the resulting 12-word mnemonic matches the list above.

Notes on this example:

- This example uses a low-variance roll sequence for readability. In practice, use full-entropy roll sequences (≈50 dice rolls for 12 words) with high variance.
- Because the first roll is the most significant digit, the value N is large even though most trailing digits are zero. The left-trim to 32 hex characters is an artifact of this example; with a typical high-entropy sequence, the full hex will naturally fit within the required length.
- The key pipeline is: recorded rolls → base-6 digits (MSB-first) → big-endian hex → raw entropy → SHA-256 checksum → 11-bit indexes → mnemonic.
- NOTE*: As of v1.0.8, the implementation requires a minimum of 52 rolls for 12 words (to reduce modulo bias). This example uses 50 rolls for compact mathematical demonstration; in practice, append two additional rolls to meet the current minimum.

---

## Acknowledgements & References

- BIP-39: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- Ian Coleman BIP39 tool: https://iancoleman.io/bip39/
- SHA-256, PBKDF2 specifications (NIST and RFC references)
