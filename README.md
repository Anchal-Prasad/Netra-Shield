# NetraShield — Two-Stage IoT Network Intrusion Detection System

> A machine learning–based Intrusion Detection System (IDS) for detecting and classifying malicious IoT network traffic using a two-stage hierarchical approach.

## 📌 Overview

**NetraShield** is an end-to-end IoT network intrusion detection system .
The system uses a **two-stage hierarchical machine learning pipeline**:

1. **Stage 1 — Binary Detection:** Determines whether network traffic is **benign or an attack**.
2. **Stage 2 — Attack Classification:** Classifies detected attacks into known attack categories or labels low-confidence predictions as **Unknown Attack**.

The complete system supports **manual feature input, CSV files, and raw PCAP files**, and combines a machine learning prediction engine with a **FastAPI backend, Supabase database, React dashboard, and cloud deployment**.
 -Dashboard
<img width="1838" height="959" alt="3" src="https://github.com/user-attachments/assets/4d21125e-9aee-44de-ab02-70f0e9e4e62c" />
<img width="1842" height="761" alt="4" src="https://github.com/user-attachments/assets/1b140977-01c2-4b21-b2db-f2b8a0989c0c" />
-Database Supabase
<img width="1577" height="913" alt="2" src="https://github.com/user-attachments/assets/9ac02bfd-0237-4603-92c9-8c36c1cc2c81" />
-->Matrix
<img width="372" height="287" alt="1" src="https://github.com/user-attachments/assets/341aafd5-4d62-4a32-8ac5-c7a4a94138ac" />




---

## 🎯 Problem Statement

IoT networks contain large numbers of resource-constrained devices that can become targets for different types of cyberattacks.

Traditional signature-based detection systems primarily depend on previously known attack patterns and may struggle with unfamiliar or evolving attacks.

NetraShield addresses this by:

* Separating normal traffic from malicious traffic.
* Classifying malicious traffic into known attack categories.
* Providing an **Unknown Attack** fallback instead of forcing uncertain traffic into a known class.
* Supporting multiple network-data input formats.
* Providing a usable dashboard for prediction history and analysis.

---

## 🧠 System Approach

```text
                  Network Traffic
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       Manual          CSV           PCAP
        Input          File           File
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                Feature Extraction
                        │
                 25 Selected Features
                        │
                  RobustScaler
                        │
                        ▼
              ┌─────────────────────┐
              │     Stage 1         │
              │  Binary XGBoost     │
              │                     │
              │ Benign / Attack     │
              └──────────┬──────────┘
                         │
                  Attack detected
                         │
                         ▼
              ┌─────────────────────┐
              │     Stage 2         │
              │ Multiclass XGBoost  │
              │                     │
              │ Known Attack /      │
              │ Unknown Attack      │
              └──────────┬──────────┘
                         │
                         ▼
                FastAPI REST API
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Supabase Database      React Dashboard
```

---

## 🛠️ Technology Stack

| Layer              | Technologies                      |
| ------------------ | --------------------------------- |
| Machine Learning   | Python, XGBoost, Scikit-learn     |
| Data Processing    | Pandas, NumPy                     |
| Feature Extraction | Scapy                             |
| Backend            | FastAPI, REST APIs                |
| Frontend           | React.js, Tailwind CSS            |
| Database           | Supabase / PostgreSQL             |
| Deployment         | Docker, Hugging Face Spaces       |
| Dataset            | CIC IIoT Dataset 2025 (DataSense) |
| Version Control    | Git, GitHub                       |

---

## 📊 Dataset

The system was trained and evaluated using the **CIC IIoT Dataset 2025 (DataSense)**.

* **685,671 network flows**
* **94 raw features**
* **7 attack categories**
* Benign traffic included

### Attack Categories

* Recon
* DoS
* DDoS
* MITM
* Malware
* Brute Force
* Web Attack

### Preprocessing

The preprocessing pipeline included:

* Removal of identifying and redundant fields.
* Missing-value handling.
* Group-based train/test splitting to reduce data leakage.
* Mutual Information-based feature selection.
* Reduction from **94 raw features to 25 selected features**.
* RobustScaler normalization.
* Outlier clipping.
* SMOTE and class weighting for class imbalance.

---

## 🤖 Machine Learning Pipeline

### Stage 1 — Binary Detection

An **XGBoost binary classifier** determines whether traffic is:

```text
Benign
   or
Attack
```

Probability calibration is performed using **Platt Scaling**.

A validation-set-based threshold is used instead of selecting the threshold directly from the test set, helping avoid threshold-selection leakage.

**Test-set results:**

* **F1 Score:** 0.9947
* **AUC-ROC:** 1.0000

---

### Stage 2 — Multiclass Attack Classification

Traffic identified as an attack is passed to a second **XGBoost multiclass classifier**.

The system attempts to identify the attack category:

```text
Recon
DoS
DDoS
MITM
Malware
Brute Force
Web Attack
```

When the prediction confidence is below the calibrated threshold, the system returns:

```text
Unknown Attack
```

This prevents the system from automatically forcing uncertain traffic into a known attack category.

**Macro F1 Score:** ~0.79 on the test set.

---

## 📥 Input Modes

NetraShield supports three prediction modes.

### 1. Manual Input

Users can enter the required network-flow features manually through the dashboard.

### 2. CSV Upload

CSV files can be processed in batch mode.

The system supports different CSV formats and maps available columns to the required 25 model features.

### 3. PCAP Upload

Raw packet captures can be uploaded directly.

The system uses **Scapy** to:

1. Read packets.
2. Group packets into bidirectional flows.
3. Extract network-flow statistics.
4. Generate the required 25 features.
5. Pass them through the hierarchical prediction pipeline.

---

## 🏗️ Architecture

NetraShield follows a **three-tier architecture**.

### Tier 1 — Data Ingestion

Responsible for receiving and validating:

* Manual feature input
* CSV files
* PCAP files

### Tier 2 — Prediction Engine

Responsible for:

* Feature preprocessing
* Stage 1 binary classification
* Probability calibration
* Stage 2 attack classification
* Unknown-attack detection

### Tier 3 — Storage & Visualization

Responsible for:

* REST API communication
* Prediction persistence
* Prediction history
* Attack distribution
* Dashboard visualization

```text
┌─────────────────────────────────────────────┐
│              Data Ingestion                 │
│     Manual Input | CSV | PCAP               │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             Prediction Engine               │
│                                             │
│  Feature Processing → Stage 1 → Stage 2    │
│                                             │
│  Benign / Attack → Known / Unknown Attack  │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│           API / Storage / UI                │
│                                             │
│ FastAPI → Supabase → React Dashboard       │
└─────────────────────────────────────────────┘
```

---

## 🔌 Backend API

The FastAPI backend exposes the following endpoints:

| Method | Endpoint          | Purpose                      |
| ------ | ----------------- | ---------------------------- |
| `GET`  | `/health`         | Health check                 |
| `POST` | `/predict/manual` | Predict from manual features |
| `POST` | `/predict/csv`    | Batch prediction from CSV    |
| `POST` | `/predict/pcap`   | Prediction from PCAP files   |

The backend handles:

* File uploads
* Feature extraction
* Model inference
* Input validation
* Prediction responses
* Database persistence

---

## 🗄️ Database

**Supabase PostgreSQL** is used to persist prediction results.

Stored information supports:

* Prediction history
* Attack categories
* Confidence/probability information
* Historical analysis
* Dashboard statistics

---

## 🖥️ Dashboard

The React dashboard provides a visual interface for interacting with the detection system.

It includes:

* Prediction statistics
* Prediction history
* Attack distribution
* Security trends
* Manual prediction input
* CSV upload
* PCAP upload
* Classification results

---

## 🚀 Deployment

The backend and trained model artifacts are deployed using **Docker on Hugging Face Spaces**.

```text
React Dashboard
       │
       ▼
FastAPI Backend
       │
       ├── XGBoost Models
       ├── Feature Extraction
       └── Prediction Pipeline
       │
       ▼
Supabase PostgreSQL
```

---

## 📈 Key Results

| Component         |                Result |
| ----------------- | --------------------: |
| Dataset           | 685,671 network flows |
| Raw Features      |                    94 |
| Selected Features |                    25 |
| Stage 1 F1        |                0.9947 |
| Stage 1 AUC-ROC   |                1.0000 |
| Stage 2 Macro F1  |                 ~0.79 |
| Input Modes       |     Manual, CSV, PCAP |

Stage 1 achieved strong separation between benign and attack traffic.

Stage 2 performed particularly well for some attack categories but showed confusion between **DoS and DDoS**, highlighting the limitations of relying primarily on aggregate flow-level features.

---

## ⚠️ Limitations

The current implementation has several known limitations:

* Evaluation was performed on a single dataset.
* DoS and DDoS traffic can be difficult to distinguish using the selected flow-level features.
* The system performs **batch inference**, not continuous live packet-stream detection.
* Detection does not inspect packet payload contents.
* Lightweight edge-device deployment was not benchmarked for memory or latency.
* SMOTE helps with class imbalance but cannot generate genuinely novel attack behavior.

---

## 🔮 Future Improvements

Possible extensions include:

* Real-time packet-stream detection.
* Evaluation on additional IoT security datasets.
* Improved DoS/DDoS feature representation.
* Payload-aware detection where appropriate.
* Edge-device performance benchmarking.
* Further optimization of the open-set recognition mechanism.

---

## 📚 Key Learnings

This project provided practical experience in:

* Hierarchical machine learning.
* Network intrusion detection.
* Feature engineering and selection.
* Handling highly imbalanced datasets.
* Model calibration and threshold selection.
* PCAP-based network-flow extraction.
* REST API development with FastAPI.
* React dashboard development.
* Database integration with Supabase.
* Docker-based deployment.
* Building and deploying an end-to-end ML system rather than only a standalone model.

---

## 👩‍💻 Internship

**Machine Learning Intern — DRDO, Office of Advisor (Cyber)**
**March 2026 – June 2026**

**Project:** NetraShield — A Machine Learning-Based IoT Network Threat Detection System Using Two-Stage Hierarchical Approach

---

## 📖 References

The project was informed by research on:

* Hierarchical intrusion detection using XGBoost.
* Open-set recognition for unknown IoT attacks.
* Hierarchical classification for intrusion detection.
* Network-flow feature extraction.
* ML-based security monitoring.

The complete references are available in the accompanying internship report.
