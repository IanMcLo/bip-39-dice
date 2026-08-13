# Technical & Cryptographic Specification

This document details the information-theoretic foundations, entropy bounds, framing pipeline, and security model of the `bip-39-dice` physical seed generator.

---

## 1. Information-Theoretic Foundations

### 1.1 Physical Entropy Source & Bernoulli Mapping
Entropy generation relies on physical 6-sided dice rolls mapped to binary digits:

$$\text{Roll} \in \{1, 2, 3\} \rightarrow 0 \quad | \quad \text{Roll} \in \{4, 5, 6\} \rightarrow 1$$

Under the assumption of an unbiased die, each roll represents an independent and identically distributed (i.i.d.) Bernoulli trial with probability $p = 0.5$.

* **Shannon Entropy ($H$):** Measures average uncertainty per trial.
  $$H(X) = - \sum_{i=1}^{n} P(x_i) \log_2 P(x_i) = - (0.5 \log_2 0.5 + 0.5 \log_2 0.5) = 1.00 \text{ bit/roll}$$

* **Min-Entropy ($H_\infty$):** Measures worst-case predictability (the probability of guessing the output on the first attempt).
  $$H_\infty(X) = -\log_2 \left( \max_i P(x_i) \right) = -\log_2(0.5) = 1.00 \text{ bit/roll}$$

Because $H(X) = H_\infty(X) = 1.00$, the physical entropy source achieves maximum uniform min-entropy prior to software ingestion.

---

## 2. Framing, Checksum & Word Slicing

### 2.1 Bitstream Framing
BIP-39 demands raw entropy bit lengths ($E$) that are multiples of 32 bits. The required dice rolls ($N_{\text{rolls}}$) directly match the raw entropy requirement:

| Target Mnemonic | Raw Entropy Bits ($E$) | Checksum Bits ($CS = E / 32$) | Total Bitstream ($E + CS$) |
| :--- | :--- | :--- | :--- |
| **12 Words** | 128 bits | 4 bits | 132 bits |
| **15 Words** | 160 bits | 5 bits | 165 bits |
| **24 Words** | 256 bits | 8 bits | 264 bits |

### 2.2 SHA-256 Checksum Derivation
The trailing checksum bits are computed deterministically over the raw byte sequence:

$$\text{Digest} = \text{SHA-256}(\text{Raw Entropy})$$

$$\text{Checksum} = \text{Digest} \left[ 0 : \frac{E}{32} \right]$$

#### Cryptographic Independence
Because SHA-256 is collision-resistant and preimage-resistant, appending $CS$ bits calculated from the raw entropy array does not increase or decrease the underlying min-entropy $H_\infty$ of the raw $E$-bit sequence. The effective key space for an attacker remains bounded by $2^E$.

### 2.3 Dictionary Slicing
The concatenated binary sequence $S = \text{Raw Entropy} \mathbin{\Vert} \text{Checksum}$ of length $L = E + CS$ is partitioned into 11-bit chunks:

$$W_k = S[11k : 11(k+1) - 1] \quad \text{for } k \in \left[0, \frac{L}{11} - 1\right]$$

Each 11-bit integer $W_k \in [0, 2047]$ maps directly to an index in the standard BIP-39 English word list.

---

## 3. Empirical vs. Theoretical Min-Entropy Analysis

When evaluating generated hex strings via empirical statistical methods, resolution size introduces sampling artifacts that must be distinguished from true entropy loss:

### 3.1 Single-Bit Empirical Variance
For a 160-bit raw entropy string, the expected number of ones in a fair coin-toss model is $\mu = 80$ with standard deviation $\sigma = \sqrt{160 \cdot 0.25} \approx 6.32$. 

A sample showing 82 ones and 78 zeros lies within $0.32\sigma$ of the mean:
$$p_{\max} = \frac{82}{160} = 0.5125$$
$$H_{\infty, \text{empirical}} = 160 \times (-\log_2 0.5125) \approx 154.30 \text{ bits}$$

This minor variance reflects expected binning behavior of a single sample, not a weakness in the key space.

### 3.2 Byte-Level Sampling Limitations
Evaluating a short sequence (e.g., $N = 20$ bytes) at an 8-bit resolution yields a maximum possible empirical frequency of $p_{\max} = 1/20 = 0.05$ for all distinct bytes:

$$H_{\infty, \text{byte}} = 20 \times (-\log_2 0.05) \approx 86.44 \text{ bits}$$

This figure is a mathematical lower-bound artifact of small sample size ($N=20$), not a reduction in true security. The full security margin remains $2^{160}$.

---

## 4. Downstream Key Derivation Architecture

This tool generates the raw BIP-39 mnemonic phrase and verifies checksum consistency. Upon importing the generated phrase into standard wallet software (e.g., Electrum, Eternl, Coldcard):

1. **Key Stretching (PBKDF2):** The phrase is converted into a uniform 512-bit master seed using standard key derivation:
   $$\text{Seed} = \text{PBKDF2-HMAC-SHA512}(\text{Mnemonic}, \text{"mnemonic"} + \text{Passphrase}, 2048, 512)$$
2. **Randomness Extraction:** The PRF construction acts as a randomness extractor, smoothing any minor statistical non-uniformities in the raw physical sequence into uniform pseudorandom keying material.
