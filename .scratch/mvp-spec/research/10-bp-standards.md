# Ticket 10 — BP / Vital-Sign Thresholds for a HOME Follow-Up App (China)

**Status:** Research findings, not medical advice.
**Date:** 2026-07-23
**Author:** research subagent

> **DISCLAIMER — 医学免责声明:** The thresholds below are **reference values compiled from published clinical guidelines for engineering/product-spec purposes only**. They are NOT medical advice and must NOT be used to drive individual diagnosis or treatment decisions. A licensed clinician (心内科/高血压专科) must review and sign off on any threshold the app encodes before launch. Individual patients have individualized targets (age, comorbidities, pregnancy, frailty, CKD, diabetes, etc.). The app should display a disclaimer to end users on every threshold-driven screen.

---

## 1. Headline finding — the prototype is using OFFICE thresholds, which is wrong for a self-measurement app

The current prototype uses **140/90 (high)** and **90/60 (low)** and computes 达标率 as "% of readings ≤140/90." These are **诊室 (office/clinic)** diagnostic thresholds.

For a **家庭血压监测 (home BP / self-measurement)** follow-up app, Chinese and international guidelines agree the diagnostic cut-off is **lower: ≥135/85 mmHg**. Using 140/90 in a home context will systematically **under-flag** genuinely hypertensive home readings (the "masked" 135–139 / 85–89 range), so the app's status labels and 达标率 will both be inaccurate.

| Measurement context | Hypertension cut-off (SBP/DBP) | Source |
|---|---|---|
| **诊室 Office (clinic)** | ≥ **140 / 90** mmHg | 中国高血压防治指南 2024; ISH 2020; WHO |
| **家庭 Home (self-measured)** | ≥ **135 / 85** mmHg (5–7 day average) | 中国高血压防治指南 2024; 家庭血压监测共识; ISH 2020; 2024 ESC |
| 24h ambulatory (24h avg) | ≥ 130 / 80 mmHg | 中国 2024; ISH 2020 |
| Ambulatory daytime avg | ≥ 135 / 85 mmHg | ISH 2020; AAFP summary |
| Ambulatory nighttime avg | ≥ 120 / 70 mmHg | ISH 2020; 中国 2024 |

**Action:** switch the app's high-BP threshold and 达标率 denominator to the **home (135/85)** standard, because users self-measure.

---

## 2. Recommended BP status bands (HOME basis)

These are the values the app should encode. They keep the existing 4-band structure but re-anchor the upper bound to the **home** threshold and add an "elevated/正常高值" advisory band consistent with 中国 2024.

| Band (label) | SBP (mmHg) | DBP (mmHg) | Meaning |
|---|---|---|---|
| **偏低 Low (hypotension)** | **< 90** | **< 60** | 同 OR 逻辑: SBP<90 OR DBP<60 → 偏低。Symptomatic → seek care. |
| **正常 Normal** | **90–119** | **60–79** | 理想/正常血压 (中国 2024: 正常 <120/80) |
| **正常高值 Elevated (advisory)** | **120–134** | **80–84** | "正常高值" / 高血压易患人群; nudge lifestyle, re-measure. Not "达标失败." |
| **偏高 High (home hypertension)** | **≥ 135** | **≥ 85** | OR logic: SBP≥135 OR DBP≥85 → 偏高 (uncontrolled home BP) |

**Notes on the OR logic.** Hypertension is defined as SBP ≥ threshold **OR** DBP ≥ threshold (either one suffices). The prototype's OR logic is correct in principle; only the cut-off numbers are wrong. The same applies to the low band.

**"正常高值" band (120–134 / 80–84) — recommended but optional.** 中国高血压防治指南 2024 explicitly defines 130–139/85–89 (office) as a high-risk "易患人群" range and recommends lifestyle intervention + periodic re-screen. Carrying this over as an advisory band (on the home scale, 120–134/80–84) improves the app's usefulness for early follow-up without over-diagnosing. If the team prefers a 3-band UI, fold this into "正常" with a soft nudge.

---

## 3. 达标率 (control rate) definition — must change

**Current (incorrect for home):** % of readings ≤ 140/90.
**Recommended (home basis):** % of readings with **SBP ≤ 135 AND DBP ≤ 85**.

- Control target for home BP per 中国 2024 and ISH: **≤ 135/85 mmHg**. (Stricter <130/80 is for higher-risk/younger tolerant patients on office scale; on the home scale the analogous stricter target is ≈ <130/80 office ↔ <125/79 home — do NOT impose this as the default 达标 line.)
- For a general adult follow-up population, **达标 = home reading ≤ 135/85**. That is the single number the app should compute 达标率 against.
- Edge case: both SBP and DBP must be ≤ target (AND), not OR. The current prototype treats the 140/90 line per-value but should be recomputed as SBP≤135 **AND** DBP≤85.
- **Morning hypertension (清晨高血压):** home BP measured in the morning (晨起至上午10点前) averaging **≥ 135/85 mmHg** = 清晨高血压 (中国 2024). Strongly recommended to tag morning readings separately and, if ≥135/85, surface a 清晨高血压 flag — this is a major predictor of stroke and is a specific reason patients are enrolled in 随访 programs. The app should at minimum let users mark a reading as "清晨" and compute a morning 达标率.

---

## 4. Low BP (hypotension) — keep at < 90 / < 60

- Standard definition: **SBP < 90 mmHg and/or DBP < 60 mmHg.** Confirmed across Mayo Clinic, Chinese clinical references, and WHO.
- For a follow-up app, low readings are mostly relevant for: overtreatment in elderly patients, postural/orthostatic symptoms, and adverse drug events. Flag for clinician review, not emergency, unless accompanied by symptoms (dizziness, syncope, fall).
- The prototype's < 90 / < 60 is correct — **do not change it.**

---

## 5. Heart rate (心率) — flag if shown

Adult resting HR normal range and flag thresholds (consistent across Mayo, Chinese clinical references):

| Classification | HR (bpm) |
|---|---|
| 正常 Normal (adult, resting) | **60 – 100** |
| 心动过缓 Bradycardia (flag) | **< 60** |
| 心动过速 Tachycardia (flag) | **> 100** |
| 警示 / seek care | **< 50 or > 120**, OR any abnormal range with symptoms (chest pain, syncope, dyspnea) |

Notes:
- Well-trained athletes may rest < 60 and be normal — a self-measurement app can't tell, so flag softly and let the clinician interpret.
- BP devices that also report HR (most electronic 上臂式 monitors do) should display HR but the app should NOT derive a separate "达标率" for HR. Use it as contextual info + a soft flag at < 60 / > 100.
- HR at the moment of BP measurement is the relevant value; "静息" assumes the user was seated and resting for ≥5 min — the app's measurement instructions should enforce this.

---

## 6. SpO2 (血氧饱和度) — flag if shown

| Classification | SpO2 (%) |
|---|---|
| 正常 Normal | **≥ 95%** (typically 95–100) |
| 偏低 / observe (mild) | **90 – 94%** — investigate, especially if persistent or with symptoms |
| 低氧血症 Hypoxemia (flag, likely urgent) | **< 90%** |
| 严重缺氧 Severe (urgent) | **< 80%** |

Notes:
- **90% is the universally accepted hypoxemia cut-off** (Mayo Clinic, WHO, clinical convention). The app should flag any reading < 90% prominently and advise contacting a clinician / emergency services if symptomatic.
- 90–94% is below normal and warrants attention but is not by itself an emergency; in a follow-up context, surface as "偏低, 请关注" and trend it.
- **Special population caveat — COPD (慢阻肺):** for COPD patients the target is ~88–92%; do NOT push them toward 99%. The app should not apply the generic ≥95 "normal" label to known COPD users without a clinician override. Flag this as a future personalization feature; for MVP, add a user-facing note that targets differ for chronic lung disease.
- Consumer pulse oximeters have meaningful accuracy limits (especially skin pigmentation, poor perfusion, cold fingers). SpO2 in a phone-app context is informational; the app should display it with a disclaimer, not as a diagnostic value.
- WHO/临床 convention: SpO2 < 90% (or PaO2 < 60 mmHg) = respiratory failure threshold.

---

## 7. Recommended SPEC for the app to encode

```yaml
# All values require clinician sign-off before launch. See disclaimer above.
context: home_self_measurement   # NOT office/clinic

blood_pressure:
  unit: mmHg
  logic: "high if SBP>=hi OR DBP>=hi; low if SBP<lo OR DBP<lo"
  bands:
    low:        { sbp_max: 89,  dbp_max: 59 }     # <90 / <60
    normal:     { sbp: [90,119], dbp: [60,79] }    # ideal/normal
    elevated:   { sbp: [120,134], dbp: [80,84] }   # 正常高值, advisory only
    high:       { sbp_min: 135, dbp_min: 85 }      # >=135/85 = home HTN
  hypertensive_reading: "SBP>=135 OR DBP>=85"
  control_target_home: "SBP<=135 AND DBP<=85"     # 达标 line
  达标率: "% of home readings where SBP<=135 AND DBP<=85"
  morning_hypertension:
    flag_when: "morning reading (晨起–10:00) with SBP>=135 OR DBP>=85"
    tag_field: true   # let users mark a reading as 清晨; compute morning 达标率
  emergency_flags:                          # surface prominent "seek care" UI
    hypertensive_crisis: "SBP>=180 OR DBP>=110"
    severe_hypotension: "SBP<90 OR DBP<60 with symptoms"

heart_rate:                                 # contextual + soft flag only
  unit: bpm
  normal: [60, 100]
  bradycardia_flag: "<60"
  tachycardia_flag: ">100"
  seek_care_flag: "<50 or >120"
  compute达标率: false

spo2:                                       # informational; display disclaimer
  unit: percent
  normal_min: 95
  observe:   [90, 94]
  hypoxemia_flag: "<90"                      # prominent flag
  severe_flag: "<80"
  copd_override_target: [88, 92]             # future: per-user clinician override
  compute达标率: false

display:
  user_disclaimer: "本结果仅供参考，不构成医疗诊断。具体诊断与治疗请咨询医生。"
  measurement_instructions:
    - 静坐休息≥5分钟后测量
    - 上臂式电子血压计，袖带与心脏齐平
    - 每日早晚各测1次，连续5–7天取平均值用于评估
```

---

## 8. Sources (cited)

Primary guideline / authoritative sources used:

1. **《中国高血压防治指南（2024年修订版）》** (中国高血压联盟 / 中华心血管病杂志) — hypertension diagnosis 140/90 office, **135/85 home**, 清晨高血压 ≥135/85, control target ≤135/85 home; 130–139/85–89 = 易患人群. Update-interpretation PDF: http://zhgxyzz.xml-journal.net/cn/article/pdf/preview/10.16439/j.issn.1673-7245.2025.01.004.pdf
2. **《国家基层高血压防治管理指南 2025 版》** (国家卫健委基层卫生) — 正常 <120/80; 正常高值 120–139/80–89; 高血压 ≥140/90 (office). https://bookcafe.yuntsg.com/ueditor/jsp/upload/file/20251003/1759482019584069121.pdf
3. **ISH 2020 Global Hypertension Practice Guidelines** (Unger et al., *J Hypertens* 2020;38(6):982–1004) — Office 140/90, **Home 135/85**, 24h 130/80, day 135/85, night 120/70; target <130/80 if <65y and tolerant else <140/90. ISH official: https://ish-world.com/global-hypertension-practice-guidelines ; AAFP summary: https://www.aafp.org/afp/2021/0615/p763
4. **2024 ESC Guideline for the Management of Hypertension / elevated BP** — HBPM avg ≥135/85 = hypertension; ambulatory ≥130/80. https://www.cardioaragon.com/wp-content/uploads/2024-ESC-Guidelines-for-the-management-of-hypertension.EHeartJ.2024_.pdf
5. **2023 ESH Hypertension Guideline Update** (ACC summary) — diagnosis >140/90; target <130/80 high-risk. https://www.acc.org/latest-in-cardiology/articles/2024/02/05/11/43/2023-esh-hypertension-guideline-update
6. **Mayo Clinic — Hypotension** (低血压): BP < 90/60 mmHg. https://www.mayoclinic.org/zh-hans/diseases-conditions/low-blood-pressure/symptoms-causes/syc-20355465
7. **Mayo Clinic — Bradycardia / Heart rate**: adult resting 60–100 bpm; <60 bradycardia; >100 tachycardia. https://www.mayoclinic.org/zh-hans/diseases-conditions/bradycardia/symptoms-causes/syc-20355474 ; https://www.mayoclinic.org/zh-hans/healthy-lifestyle/fitness/expert-answers/heart-rate/faq-20057979
8. **Mayo Clinic — Hypoxemia (SpO2)**: normal 95–100%; <90% = hypoxemia. https://www.mayoclinic.org/zh-hans/symptoms/hypoxemia/basics/when-to-see-doctor/sym-20050930

Uncertainty / items requiring clinician confirmation:
- The exact home equivalent of the stricter <130/80 office target (some sources map it to ≈125/79 home; 中国 2024 keeps the patient-level target on the office scale). For MVP 达标率, use ≤135/85.
- Age-stratified targets (≥65/≥80 years, frail elderly) and disease-specific targets (diabetes, CKD, pregnancy) were intentionally NOT encoded — these require per-user clinician configuration in a later phase.
- Whether to show SpO2 at all in MVP: consumer-device accuracy and the COPD caveat make it the riskiest vital to display. Recommend clinician review before shipping SpO2 flags.
