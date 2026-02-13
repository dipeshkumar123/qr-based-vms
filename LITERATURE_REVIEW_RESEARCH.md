# Literature Review & Related Work — Research Compilation
## QR-Based Visitor Management System with Facial Recognition and Blockchain Audit Trails

> **Purpose:** Structured research findings for the Related Work and Literature Review sections of the research paper.
> **Date Compiled:** February 2026

---

## Table of Contents
1. [Visitor Management Systems](#1-visitor-management-systems)
2. [QR Code Technology](#2-qr-code-technology)
3. [Facial Recognition & Biometric Authentication](#3-facial-recognition--biometric-authentication)
4. [Blockchain & Hash Chains for Audit Trails](#4-blockchain--hash-chains-for-audit-trails)
5. [Anomaly Detection — Isolation Forest](#5-anomaly-detection--isolation-forest)
6. [IoT & Smart Building Access Control](#6-iot--smart-building-access-control)
7. [Directly Related Work (QR + VMS + Biometric Papers)](#7-directly-related-work-qr--vms--biometric-papers)
8. [Comparison Tables](#8-comparison-tables)

---

## 1. Visitor Management Systems

### Definition & Overview
Visitor management refers to a set of practices or hardware additions that administrators use to monitor the usage of a building or site. By gathering this information, a visitor management system (VMS) can record the usage of facilities by specific visitors and provide documentation of visitors' whereabouts (Wikipedia, "Visitor management").

### Evolution of VMS Technologies

| Generation | Type | Characteristics |
|---|---|---|
| 1st Gen | Pen & Paper | Manual logbooks; no verification; privacy risks; easily forged |
| 2nd Gen | On-premises Software | Computer-based; ID scanning; database checks; local hosting |
| 3rd Gen | Cloud-based SaaS | Tablet/kiosk apps; thin-client; remote management; multi-site support |
| 4th Gen | Smartphone-based | Real-time notifications; QR codes; geofencing; touchless sign-in |

### Key Capabilities of Modern VMS
- **ID Verification:** Visitor ID checked against national and local databases, including criminal and sex offender registries (Moorhouse, 2008; Toppo, 2006; Hegarty, 2018)
- **Integration:** Cloud-based systems offer open APIs for integration with communication apps, access control hardware, Wi-Fi credentialing, and data reporting systems
- **Touchless Operations:** Smartphone-based systems enable automatic and touchless sign-in using QR codes and geofencing — accelerated by COVID-19 pandemic requirements
- **Use Cases:** Hospitals (York & MacAlister, 2015), schools, commercial buildings, offices, convention centers, co-working spaces

### Research Gap
Traditional VMS solutions lack integrated multi-factor authentication combining *something you have* (QR code) with *something you are* (facial biometrics), and provide no cryptographic guarantee of audit trail integrity. This research addresses that gap.

---

## 2. QR Code Technology

### History & Origin
- **Invented:** 1994 by **Masahiro Hara** at **Denso Wave** (Japan) for tracking automobile parts
- **Design Inspiration:** Black and white Go board counters; position detection markers use the least-used 1:1:3:1:1 alternating black-white pattern found on printed matter
- **Original Purpose:** Replace individually-scanned barcode labels with a single label containing data for multiple labels, supporting kanji, kana, and alphanumeric codes

### Standards Timeline
| Year | Standard | Notes |
|---|---|---|
| 1997 | AIM International | First standard |
| 1999 | JIS X 0510 | Japanese Industrial Standard |
| 2000 | ISO/IEC 18004:2000 | Defines QR Code models 1 and 2 |
| 2006 | ISO/IEC 18004:2006 | QR Code 2005 specification |
| 2015 | ISO/IEC 18004:2015 | Renames to "QR Code"; clarifications |
| 2022 | ISO/IEC 23941:2022 | Rectangular Micro QR Code (rMQR) |
| **2024** | **ISO/IEC 18004:2024** | **Current standard;** optimized encoding, improved error correction, refined structured append |

### Technical Specifications — Information Capacity (Version 40-L)

| Input Mode | Max Characters | Bits/Character | Character Set |
|---|---|---|---|
| Numeric | **7,089** | 3⅓ | 0–9 |
| Alphanumeric | **4,296** | 5½ | 0–9, A–Z, space, $%*+-./:  |
| Binary/Byte | **2,953** | 8 | ISO/IEC 8859-1 |
| Kanji/Kana | **1,817** | 13 | Shift JIS X 0208 |

### Error Correction (Reed–Solomon)

| Level | Recovery Capability | Use Case |
|---|---|---|
| L (Low) | **7%** of data bytes | Maximum storage capacity |
| M (Medium) | **15%** of data bytes | General use (default) |
| Q (Quartile) | **25%** of data bytes | Industrial environments |
| H (High) | **30%** of data bytes | Harsh conditions; artistic QR codes |

- Uses **Reed–Solomon error correction** over finite field F₂₅₆ (GF(2⁸))
- Version 1 QR (21×21): (26,19,2) code — 19 message bytes + 7 EC bytes, corrects up to 2 byte errors
- Version 3 QR (29×29): Two interleaved (35,13) code blocks — corrects up to 22 byte-errors combined
- Larger symbols limited to max 15 errors per block to bound decoding complexity

### Versions & Dimensions
- **Version 1:** 21×21 modules → **Version 40:** 177×177 modules
- Formula: 4 × version number + 17 modules per side
- 40 versions available for standard QR; 4 versions for Micro QR

### QR Code Variants

| Variant | Key Feature | Application |
|---|---|---|
| Model 1 / Model 2 | Standard square QR | General purpose |
| Micro QR | 11×11 to 17×17; max 35 numeric chars | Space-constrained labels |
| rMQR (2022) | Rectangular; width/height ratio up to 19:1 | Cylindrical objects |
| **SQRC (Secure QR)** | **Encrypted private data segment** | **Storing private/internal information** |
| Frame QR | Central empty area for artwork/branding | Marketing |
| iQR | 30% less space; 50% error correction (Level S) | High-density applications |

### Adoption Statistics
- **2011:** 14 million US users scanned QR/barcodes; 58% from home, 39% from retail stores
- **2022:** **89 million US users** scanned QR codes (↑26% from 2020) — primarily for payments and menu access
- **COVID-19 Acceleration:** September 2020 survey: 18.8% of US/UK consumers strongly agreed QR code use increased since pandemic restrictions began
- **China:** As of 2018, ~83% of all payments made via mobile payment (Alipay QR codes since 2011)

### Security Applications
- **Counterfeit detection:** Serialized QR codes with digital watermarks or copy detection patterns for brand protection (Baldini et al., 2015)
- **Authentication:** Time-based one-time passwords (TOTP) via QR codes
- **Certificate verification:** NEN (Netherlands) uses blockchain + QR codes to authenticate certificates; apostilles use cryptographic signatures with QR codes for canonical URLs

### Licensing
- QR Code technology is **freely licensed** under JIS/ISO/IEC standards (Denso Wave waived key patent rights for standardized codes)
- US Patent 5726435 expired March 2015; EU patents also expired 2015

### Key References
- Hara, M. (1994) — QR Code invention at Denso Wave
- ISO/IEC 18004:2024 — Current international standard
- Chen et al. (2019) "Adaptive Binarization of QR Code Images for Fast Automatic Sorting in Warehouse Systems" — *Sensors*, 19(24), 5466

---

## 3. Facial Recognition & Biometric Authentication

### Historical Timeline

| Year | Milestone | Researcher(s) |
|---|---|---|
| 1960s | Semi-automated facial recognition (manual landmark measurement) | **Woody Bledsoe**, Helen Chan Wolf, Charles Bisson |
| 1970s | 21 subjective markers used (lip thickness, hair color, etc.) | Goldstein, Harmon, Lesk |
| 1988 | Applied PCA (Karhunen–Loève theorem) to face recognition | Sirovich & Kirby |
| **1991** | **Eigenfaces** — real-time automated face recognition via PCA | **Turk & Pentland** |
| 1997 | **Fisherfaces** — Fisher's Linear Discriminant for face recognition | Belhumeur, Hespanha, Kriegman |
| **2001** | **Viola-Jones framework** — first real-time face detection | **Viola & Jones** |
| **2005** | **HOG (Histogram of Oriented Gradients)** for pedestrian/face detection | **Dalal & Triggs** (INRIA, CVPR 2005) |
| **2014** | **DeepFace** — deep learning face verification (97.35% accuracy on LFW) | **Facebook/Meta AI** |
| 2017 | iPhone X FaceID (3D face recognition) | Apple |

### Key Algorithms & Techniques

#### Eigenfaces / PCA (Turk & Pentland, 1991)
- Treats face images as points in high-dimensional space
- Projects onto lower-dimensional "face space" using principal components
- Enables recognition by comparing Euclidean distances between projections

#### Viola-Jones Framework (2001)
- First real-time face detector
- Uses Haar-like features + integral image + AdaBoost cascade classifier
- Processes images extremely rapidly; foundation for real-time applications

#### HOG + dlib (Dalal & Triggs, 2005)
- **Histogram of Oriented Gradients** — originally for pedestrian detection
- Concept by **Robert K. McConnell** (1986); popularized by Dalal & Triggs at **CVPR 2005**
- Optimal parameters: **8×8 pixel cells**, **16×16 pixel blocks**, **9 histogram orientation channels**
- **Performance benchmarks:**
  - MIT pedestrian dataset: **near-zero miss rate** at 10⁻⁴ false positive rate (FPPW)
  - INRIA dataset: **~0.1 miss rate** (10%) at 10⁻⁴ FPPW
- Combined with **SVM** (Support Vector Machine) for classification
- **dlib** library implements HOG-based face detection — commonly used in visitor management applications
- **Relevance to this project:** The system uses dlib's HOG-based face detector for face verification

#### DeepFace (Facebook, 2014)
- 9-layer deep neural network
- Trained on 4 million facial images from 4,000 identities
- **97.35% accuracy** on LFW (Labeled Faces in the Wild) benchmark — approaches **human-level performance (97.53%)**
- Closed the majority of the remaining gap to human performance

### Accuracy Benchmarks & Statistics

| System/Study | Accuracy/Error Rate | Year | Context |
|---|---|---|---|
| DeepFace (Facebook) | **97.35%** (LFW) | 2014 | Deep learning; near-human performance |
| FBI Next Generation Identification | **85%** | ~2014 | Government database matching |
| FRGC 2006 | **10× more accurate** than 2002 algorithms | 2006 | Controlled/uncontrolled lighting |
| FRGC 2006 vs 1995 | **100× more accurate** than 1995 | 2006 | Overall improvement |
| FRVT 2006 | High-resolution face images outperform standard | 2006 | Image quality impact |
| Metropolitan Police (London) | **1 in 6,000** false positive rate | ~2020 | Live surveillance |
| Delhi Police FRT | **2% accuracy** | 2018 | 9,000 surveillance cameras; identified 3,000 missing children in 4 days |

### Bias & Fairness (Critical Benchmark)
**Buolamwini & Gebru (2018), "Gender Shades" study:**

| Demographic | Error Rate |
|---|---|
| Lighter-skinned males | **0.0% – 0.8%** |
| Lighter-skinned females | **1.7% – 7.1%** |
| Darker-skinned males | **0.7% – 12.0%** |
| **Darker-skinned females** | **20.8% – 34.7%** |

- Demonstrated that commercial facial recognition systems (Microsoft, IBM, Face++) had significantly higher error rates for darker-skinned females
- NIST (2019) study confirmed: most algorithms exhibited demographic differentials; false positive rates varied by factor of 10-100 across demographics

### Multi-Factor Authentication (MFA) in Access Control
Access control theory defines three authentication factors (Newman, 2010; FFIEC, 2008):
1. **Something you know** — password, PIN
2. **Something you have** — smart card, QR code, key fob
3. **Something you are** — biometric (fingerprint, face, iris)

**This project combines factors 2 (QR code) and 3 (facial recognition) for two-factor authentication.**

### Key References
- Turk, M. & Pentland, A. (1991). "Eigenfaces for Recognition" — *Journal of Cognitive Neuroscience*, 3(1)
- Viola, P. & Jones, M. (2001). "Rapid Object Detection using a Boosted Cascade of Simple Features" — *CVPR 2001*
- Dalal, N. & Triggs, B. (2005). "Histograms of Oriented Gradients for Human Detection" — *CVPR 2005*
- Buolamwini, J. & Gebru, T. (2018). "Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification" — *FAT* Conference
- Taigman, Y. et al. (2014). "DeepFace: Closing the Gap to Human-Level Performance in Face Verification" — *CVPR 2014*

---

## 4. Blockchain & Hash Chains for Audit Trails

### Blockchain Overview
A blockchain is a distributed ledger with a growing list of records (blocks) securely linked together using cryptographic hashes. Each block contains:
1. **Cryptographic hash** of the previous block
2. **Timestamp**
3. **Transaction data** (generally represented as a Merkle tree)

### Historical Development

| Year | Development | Author(s) |
|---|---|---|
| 1981 | **Hash chains** for password protection | **Leslie Lamport** |
| **1991** | **Cryptographically secured chain of blocks** for tamper-proof document timestamping | **Stuart Haber & W. Scott Stornetta** |
| 1992 | Incorporated Merkle trees into the design | Haber, Stornetta & Bayer |
| **2008** | Bitcoin whitepaper — first decentralized blockchain | **Satoshi Nakamoto** |
| 2009 | Bitcoin network launched | Nakamoto |
| 2015 | Ethereum — programmable smart contracts | Vitalik Buterin |

### Hash Chains — Technical Foundation
- **Definition:** Successive application of a cryptographic hash function to a piece of data: `h¹(x) = h(x)`, `hⁿ(x) = h(hⁿ⁻¹(x))`
- **Lamport (1981):** Proposed hash chains for one-time password protection
- **Properties:**
  - Computationally easy to compute forward (hash), computationally infeasible to reverse
  - Provides **non-repudiation** by recording chronology of data existence
  - Each entry depends cryptographically on all previous entries — any tampering is detectable
- **Hash Chain vs. Blockchain:** A hash chain is the fundamental data structure; blockchain adds distributed consensus rules, peer-to-peer networking, and incentive mechanisms on top

### Blockchain Properties Relevant to Audit Trails

| Property | Description | Relevance to VMS |
|---|---|---|
| **Immutability** | Once recorded, data cannot be retroactively altered without altering all subsequent blocks | Tamper-proof visitor logs |
| **Transparency** | All participants can verify the chain | Audit accountability |
| **Chronological ordering** | Timestamped blocks in sequence | Visit time verification |
| **Cryptographic integrity** | SHA-256 hashing ensures data integrity | Detect log manipulation |
| **Non-repudiation** | Records prove events occurred | Legal compliance |

### Merkle Trees
- Used within blocks to efficiently verify transaction integrity
- Binary tree of hashes; changing any leaf changes the root hash
- Enables efficient **proof of inclusion** without downloading entire block data
- Invented by **Ralph Merkle** (1979)

### Blockchain for Certificate & Document Verification
- **NEN (Netherlands):** Uses blockchain + QR codes to authenticate certificates
- **Supply chain:** QR codes + blockchain for product traceability and anti-counterfeiting
- **Digital apostilles:** PDF documents with cryptographic signatures + QR codes for canonical URL verification

### Performance Characteristics

| Metric | Bitcoin | Ethereum |
|---|---|---|
| Block time | ~10 minutes avg | ~14-15 seconds |
| Blockchain size | 200 GB (early 2020) | — |
| Hash algorithm | SHA-256 | Keccak-256 |

### Application to This Project
This project implements a **lightweight hash-chain audit trail** (not a full distributed blockchain) that:
- Links each visitor event record to the previous via SHA-256 hash
- Provides tamper detection without the overhead of distributed consensus
- Stores chain in PostgreSQL with periodic integrity verification
- Achieves blockchain-grade immutability guarantees for a single-organization deployment

### Key References
- Lamport, L. (1981). "Password Authentication with Insecure Communication" — *Communications of the ACM*, 24(11)
- Haber, S. & Stornetta, W. S. (1991). "How to Time-Stamp a Digital Document" — *Journal of Cryptology*, 3(2), pp. 99-111
- Nakamoto, S. (2008). "Bitcoin: A Peer-to-Peer Electronic Cash System" — Bitcoin whitepaper
- Merkle, R. (1979). "A Certified Digital Signature" — *Crypto '89*

---

## 5. Anomaly Detection — Isolation Forest

### Algorithm Overview
**Isolation Forest** is an unsupervised anomaly detection algorithm proposed by **Fei Tony Liu**, **Kai Ming Ting**, and **Zhi-Hua Zhou** (2008). Unlike most anomaly detection methods that build a profile of normal instances and then identify outliers, Isolation Forest **directly isolates anomalies** by exploiting two key properties of anomalous data points:
1. They are **few** (minority)
2. They have **attribute values very different** from normal instances

### How It Works
1. **Random partitioning:** Recursively partition data by randomly selecting a feature and a random split value between the feature's min and max
2. **Isolation:** Anomalies require **fewer partitions** (shorter path lengths) to be isolated
3. **Scoring:** Average path length across multiple isolation trees yields an anomaly score

### Anomaly Score Formula

$$s(x, m) = 2^{-\frac{E(h(x))}{c(m)}}$$

Where:
- $h(x)$ = path length of observation $x$
- $E(h(x))$ = average path length over all isolation trees
- $c(m)$ = average path length of unsuccessful search in a Binary Search Tree with $m$ external nodes (normalization factor)
- $c(m) = 2H(m-1) - \frac{2(m-1)}{m}$, where $H(i)$ is the harmonic number

### Score Interpretation

| Score Range | Interpretation |
|---|---|
| $s \approx 1$ | **Definite anomaly** |
| $s \approx 0.5$ | Normal instance |
| $s \ll 0.5$ | Clearly normal |

### Algorithm Properties

| Property | Value | Advantage |
|---|---|---|
| Time complexity | **O(n log n)** (linear in practice) | Scales to large datasets |
| Space complexity | **O(n)** | Low memory footprint |
| Subsampling | Default 256 samples per tree | Enables handling of large datasets |
| Number of trees | Typically 100 | Ensemble for robustness |
| No distance/density computation | N/A | Avoids curse of dimensionality |

### Extended Isolation Forest (EIF)
- Proposed by **Hariri, Kind, & Brunner** (2018)
- Addresses scoring bias in original algorithm (axis-aligned splits create artifacts)
- Uses **hyperplane cuts with random slopes** instead of axis-aligned cuts
- Provides more reliable anomaly detection in multivariate data

### Implementation
- Implemented in **scikit-learn** (`sklearn.ensemble.IsolationForest`)
- Parameters: `n_estimators` (trees), `max_samples`, `contamination` (expected anomaly fraction)

### Application to This Project
The system uses Isolation Forest for:
- **Unusual visit pattern detection** (frequency anomalies, off-hours visits)
- **Tailgating detection** (unusually rapid successive check-ins)
- **Behavioral profiling** (deviation from normal visitor flow patterns)
- Trained on visitor event features: time-of-day, day-of-week, visit duration, visit frequency

### Key References
- **Liu, F. T., Ting, K. M., & Zhou, Z.-H. (2008).** "Isolation Forest" — *Proc. 8th IEEE International Conference on Data Mining (ICDM)*, pp. 413-422
- **Liu, F. T., Ting, K. M., & Zhou, Z.-H. (2012).** "Isolation-Based Anomaly Detection" — *ACM Transactions on Knowledge Discovery from Data*, 6(1), Article 3
- **Hariri, S., Kind, M. C., & Brunner, R. J. (2018).** "Extended Isolation Forest" — *IEEE Transactions on Knowledge and Data Engineering*

---

## 6. IoT & Smart Building Access Control

### Smart Building / Building Automation Systems (BAS)
Building Automation Systems (BAS), also known as Building Management Systems (BMS), provide automatic centralized control of a building's HVAC, electrical, lighting, shading, **access control**, security systems, and other interrelated systems (Wikipedia, "Building automation").

### Key Characteristics
- BAS-linked systems represent **~40% of building energy usage** (70% including lighting)
- Improperly configured BMS accounts for **~20% of building energy usage** (~8% of total US energy)
- Modern systems use **IoT protocols:** Zigbee, BACnet, Bluetooth Low Energy, LoRa
- Security integration: CCTV, motion detectors, access control turnstiles, fire alarms
- Occupancy sensors can reduce energy use by **up to 40%** through precise ventilation/lighting control

### Access Control — Three-Factor Authentication Model

| Factor | Type | Examples |
|---|---|---|
| Factor 1 | **Something you know** | Password, PIN, passphrase |
| Factor 2 | **Something you have** | Smart card, key fob, **QR code**, NFC device |
| Factor 3 | **Something you are** | Fingerprint, **facial recognition**, iris, voice, hand geometry |

Source: Newman, R. (2010). *Security and access control using biometric technologies*; FFIEC (2008)

### Electronic Access Control (EAC) Components
1. **Access control panel** (controller)
2. **Access-controlled entry** (door, turnstile, parking gate, elevator)
3. **Reader** (card reader, biometric scanner, **QR scanner**)
4. **Locking hardware** (electric strikes, electromagnetic locks)
5. **Door position sensor** (magnetic switch)
6. **Request-to-exit** (RTE) devices

### Access Control Topologies Evolution

| Generation | Topology | Communication |
|---|---|---|
| 1st | Serial controllers | RS-485 (max 32 devices, 4000 ft) |
| 2nd | Serial main + sub-controllers | RS-485 bus |
| 3rd | Serial + terminal servers | Serial-to-LAN conversion |
| 4th | **Network-enabled controllers** | Ethernet LAN/WAN |
| 5th | **IP controllers** | Direct IP networking |
| **6th** | **IP readers (current)** | PoE, direct IP, cloud-connected |

### Security Risks in Building Access Control
1. **Tailgating/Piggybacking** — Most common; following authorized users through doors
2. **Credential cloning** — Portable readers capturing proximity card numbers
3. **Forced door entry** — Physical brute force
4. **IoT vulnerabilities** — BAS systems repeatedly reported vulnerable to hackers (Wendzel, 2016; Granzer et al., 2010; Krstic, 2019: 100+ vulnerabilities in BMS/access control)

### IoT Access Control Research
- **Ouaddah et al. (2017).** "Access control in the Internet of Things: Big challenges and new opportunities" — *Computer Networks*, 112, pp. 237-262
- **Pereira & Fong (2019).** "SEPD: An Access Control Model for Resource Sharing in an IoT Environment" — *ESORICS 2019*
- **Granzer, Praus & Kastner (2010).** "Security in Building Automation Systems" — *IEEE Transactions on Industrial Electronics*, 57(11), pp. 3622-3630

### Relevance to This Project
This system integrates into the smart building ecosystem by:
- Using **QR codes** as digital credentials (Factor 2) scanned at IP-connected readers
- Adding **facial recognition** (Factor 3) for two-factor authentication
- Providing **blockchain-grade audit trails** for compliance and forensics
- **Anomaly detection** for identifying tailgating and unauthorized access patterns
- Cloud-based architecture supporting multi-site deployment

---

## 7. Directly Related Work (QR + VMS + Biometric Papers)

### Papers Found via Google Scholar

| # | Authors | Year | Title | Citations | Key Contribution |
|---|---|---|---|---|---|
| 1 | **Awotunde et al.** | 2024 | "A Mobile Visitor Management System Using a QR Code and PIN for Access Control" | — | QR code + PIN mobile visitor management (Springer) |
| 2 | **Oktaviandri & Foong** | 2019 | "Design and development of visitor management system" | 18 | Biometric verification (fingerprint + face recognition) integrated VMS |
| 3 | **Muthukumar & Albert Mayan** | 2019 | "QR code and biometric based authentication system for trains" | 13 | Combined QR code + biometric authentication system |
| 4 | **Gallera** | 2023 | "Designing and Evaluating a QR Code-Based Monitoring System for School Visitor Logs" | 5 | QR-based visitor monitoring for school security |
| 5 | **Nacaroğlu et al.** | 2024 | "Cyber Security Based Visitor Control System Design" | — | QR code visitor entry cards with cybersecurity focus |
| 6 | **Abd Hafiff & Khalid** | 2023 | "Dynac Visitor Management System with Facial Recognition" | — | Dynamic VMS integrating facial recognition |
| 7 | **Anh et al.** | 2024 | "Design and Implementation of Visitor Management System using mobile application for Apartment" | — | Mobile VMS for residential buildings (ACM) |
| 8 | **Khoo & Aziz** | 2023 | "Design and Development of CARE Visitor Management System" | — | Healthcare/care facility VMS |
| 9 | **Unal & Tecim** | 2018 | "The use of biometric technology for effective personnel management system" | 10 | Biometric technology in personnel/visitor management |

### Comparison with This Project

| Feature | Awotunde (2024) | Oktaviandri (2019) | Muthukumar (2019) | Abd Hafiff (2023) | **This Project** |
|---|---|---|---|---|---|
| QR Code Authentication | ✅ | ❌ | ✅ | ❌ | ✅ |
| Facial Recognition | ❌ | ✅ | ❌ | ✅ | ✅ |
| PIN/Password | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fingerprint | ❌ | ✅ | ✅ | ❌ | ❌ |
| Blockchain Audit Trail | ❌ | ❌ | ❌ | ❌ | **✅** |
| Anomaly Detection (AI) | ❌ | ❌ | ❌ | ❌ | **✅** |
| Two-Factor (QR + Face) | ❌ | ❌ | ❌ | ❌ | **✅** |
| Real-time Notifications | ❌ | ❌ | ❌ | ❌ | ✅ |
| Analytics Dashboard | ❌ | ❌ | ❌ | ❌ | ✅ |
| Web-based SaaS | ❌ | ❌ | ❌ | ❌ | ✅ |

**Key Differentiator:** No existing work combines all four pillars: QR-based identification, facial verification, blockchain audit trails, and AI-powered anomaly detection in a single integrated visitor management system.

---

## 8. Comparison Tables

### Table 1: QR Code vs. Alternative Identification Technologies

| Technology | Data Capacity | Read Speed | Cost | Durability | Forgery Resistance | Contactless |
|---|---|---|---|---|---|---|
| **QR Code** | 7,089 numeric | Instant (camera) | Near zero | Unlimited (digital) | Low (without SQRC) | ✅ |
| NFC/RFID | 48 bytes–8 KB | <100ms | $0.10–$2/tag | High (physical) | Medium | ✅ |
| Barcode (1D) | 20-25 chars | Fast (laser) | Near zero | Medium | Low | ✅ |
| Smart Card | 32-256 KB | <1s | $1–$10/card | High | High | ❌/✅ |
| Magnetic Stripe | 60-100 chars | Fast (swipe) | $0.05–$0.50 | Low (degradation) | Low | ❌ |

### Table 2: Face Detection/Recognition Algorithm Comparison

| Algorithm | Year | Speed | Accuracy (LFW) | Key Innovation | Use in This Project |
|---|---|---|---|---|---|
| Eigenfaces (PCA) | 1991 | Fast | ~60-80% | Dimensionality reduction | ❌ |
| Fisherfaces (LDA) | 1997 | Fast | ~80-90% | Discriminant analysis | ❌ |
| Viola-Jones | 2001 | Real-time | N/A (detection only) | Cascade classifier | ❌ |
| **HOG + SVM (dlib)** | **2005** | **Real-time** | **~95%** | **Gradient histograms** | **✅ (face detection)** |
| DeepFace | 2014 | Moderate | **97.35%** | Deep CNN | ❌ |
| FaceNet (Google) | 2015 | Moderate | **99.63%** | Triplet loss embedding | Reference |
| ArcFace | 2018 | Moderate | **99.82%** | Additive angular margin | Reference |

### Table 3: Anomaly Detection Algorithm Comparison

| Algorithm | Type | Time Complexity | Handles High Dimensions | Handles Large Datasets | Key Limitation |
|---|---|---|---|---|---|
| **Isolation Forest** | Tree-based | **O(n log n)** | ✅ | ✅ (subsampling) | Axis-aligned split bias |
| LOF (Local Outlier Factor) | Density-based | O(n²) | ❌ (curse of dimensionality) | ❌ | Computationally expensive |
| One-Class SVM | Kernel-based | O(n²)–O(n³) | ✅ | ❌ | Slow training |
| DBSCAN | Density-based | O(n log n) | ❌ | ✅ | Sensitive to parameters |
| Autoencoder | Neural network | Varies | ✅ | ✅ | Requires large training data |

### Table 4: Audit Trail Approaches Comparison

| Approach | Integrity Guarantee | Decentralized | Performance Overhead | Storage Overhead | Verification Speed |
|---|---|---|---|---|---|
| Plain Database Logs | ❌ (mutable) | ❌ | Minimal | Minimal | Fast |
| **Hash Chain (This Project)** | **✅ (cryptographic)** | **❌** | **Low** | **Low (~32 bytes/record)** | **O(n) full, O(1) latest** |
| Full Blockchain (Bitcoin-style) | ✅ (distributed consensus) | ✅ | High (mining) | High (200+ GB) | Variable |
| Hyperledger/Private Blockchain | ✅ (permissioned) | Partial | Moderate | Moderate | Moderate |
| Immutable Database (e.g., Amazon QLDB) | ✅ (vendor-guaranteed) | ❌ | Low | Low-Moderate | Fast |

---

## Summary of Key Statistics for the Paper

| Statistic | Value | Source |
|---|---|---|
| QR Code max numeric capacity | 7,089 characters | ISO/IEC 18004:2024 |
| QR Code max error correction | 30% (Level H) | ISO/IEC 18004:2024 |
| QR Code US users (2022) | 89 million | Statista |
| DeepFace accuracy (LFW) | 97.35% | Taigman et al. (2014) |
| Human face recognition (LFW) | 97.53% | LFW benchmark |
| FBI NGI accuracy | ~85% | FBI/NIST reports |
| FRGC improvement 2002→2006 | 10× more accurate | FRGC 2006 report |
| Gender Shades bias (dark-skinned women) | 20.8%–34.7% error | Buolamwini & Gebru (2018) |
| HOG miss rate (MIT dataset) | Near zero at 10⁻⁴ FPPW | Dalal & Triggs (2005) |
| Isolation Forest time complexity | O(n log n) | Liu, Ting & Zhou (2008) |
| BAS energy % of building | ~40% (70% w/ lighting) | Brambley (2005) |
| IoT occupancy sensor energy savings | Up to 40% | Building automation research |
| Hash chain overhead per record | ~32 bytes (SHA-256) | Cryptographic standard |

---

## Recommended Citation Format (IEEE)

```
[1] M. Hara, "QR Code," Denso Wave, 1994. ISO/IEC 18004:2024.
[2] M. A. Turk and A. P. Pentland, "Eigenfaces for recognition," J. Cogn. Neurosci., vol. 3, no. 1, pp. 71–86, 1991.
[3] P. Viola and M. Jones, "Rapid object detection using a boosted cascade of simple features," in Proc. CVPR, 2001, vol. 1, pp. I-511–I-518.
[4] N. Dalal and B. Triggs, "Histograms of oriented gradients for human detection," in Proc. CVPR, 2005, vol. 1, pp. 886–893.
[5] Y. Taigman, M. Yang, M. Ranzato, and L. Wolf, "DeepFace: Closing the gap to human-level performance in face verification," in Proc. CVPR, 2014, pp. 1701–1708.
[6] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation forest," in Proc. 8th IEEE ICDM, 2008, pp. 413–422.
[7] S. Haber and W. S. Stornetta, "How to time-stamp a digital document," J. Cryptol., vol. 3, no. 2, pp. 99–111, 1991.
[8] L. Lamport, "Password authentication with insecure communication," Commun. ACM, vol. 24, no. 11, pp. 770–772, 1981.
[9] S. Nakamoto, "Bitcoin: A peer-to-peer electronic cash system," 2008.
[10] J. Buolamwini and T. Gebru, "Gender shades: Intersectional accuracy disparities in commercial gender classification," in Proc. FAT, 2018, pp. 77–91.
[11] S. Hariri, M. C. Kind, and R. J. Brunner, "Extended isolation forest," IEEE Trans. Knowl. Data Eng., 2018.
[12] R. Newman, Security and Access Control Using Biometric Technologies. Boston, MA: Course Technology, 2010.
[13] W. Granzer, F. Praus, and W. Kastner, "Security in building automation systems," IEEE Trans. Ind. Electron., vol. 57, no. 11, pp. 3622–3630, 2010.
[14] A. Ouaddah, H. Mousannif, A. Elkalam, and A. Ouahman, "Access control in the Internet of Things: Big challenges and new opportunities," Comput. Netw., vol. 112, pp. 237–262, 2017.
[15] M. Oktaviandri and K. Y. Foong, "Design and development of visitor management system," IOP Conf. Ser., 2019.
[16] S. Muthukumar and J. Albert Mayan, "QR code and biometric based authentication system for trains," Int. J. Eng. Adv. Technol., 2019.
[17] J. B. Awotunde et al., "A mobile visitor management system using a QR code and PIN for access control," Springer, 2024.
[18] S. Abd Hafiff and N. Khalid, "Dynac visitor management system with facial recognition," 2023.
```

---

*This document was compiled from Wikipedia, Google Scholar, and related academic sources. All statistics and benchmarks should be verified against original publications before final inclusion in the research paper.*
