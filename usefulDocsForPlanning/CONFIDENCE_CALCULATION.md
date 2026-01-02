# Confidence Calculation System

## Overview

Each domain score in the Prime Scorecard has an associated **confidence level** (0-100%) that indicates how reliable the score is based on available data.

## Formula

```
Confidence = 100 × (0.35×Coverage + 0.25×Quality + 0.25×Freshness + 0.15×Stability)
```

## Components

### 1. Coverage (35% weight)

**What it measures:** What fraction of expected drivers have actual data.

- Each driver has a weight within its domain (weights sum to 1.0)
- Coverage = sum of weights for drivers that have data
- Higher coverage = more complete picture of the domain

**Example (Recovery domain):**
| Driver | Weight | Has Data? |
|--------|--------|-----------|
| Sleep Duration | 0.45 | ✓ |
| HRV | 0.30 | ✓ |
| Sleep Regularity | 0.15 | ✗ |
| Insomnia | 0.10 | ✗ |

Coverage = 0.45 + 0.30 = 0.75 (75%)

### 2. Quality (25% weight)

**What it measures:** How reliable the data sources are.

| Source Type | Multiplier | Examples |
|-------------|------------|----------|
| Lab | 1.0 | Blood test results |
| Test | 0.9 | Focus Check, grip strength test |
| Device | 0.8 | Apple Watch, smart scale |
| Measured self-report | 0.7 | User-entered with measurement |
| Image estimate | 0.55 | Body photo analysis |
| Self-report proxy | 0.4 | Questionnaire answers |
| Prior (default) | 0.2 | Population baseline |

Quality is the weighted average of source multipliers for present drivers.

### 3. Freshness (25% weight)

**What it measures:** How recent the data is.

- Each driver has a `freshness_half_life_days` in the config
- Data at the half-life age has 50% freshness
- Fresh data (< 7 days) = ~100% freshness
- Stale data (> 90 days) = near 0% freshness

**Common half-lives:**
- HRV, Sleep: 14 days
- Blood Pressure: 30 days
- Lab markers: 90 days

### 4. Stability (15% weight)

**What it measures:** Time-series consistency (baseline establishment).

- Currently **always 0** for onboarding data
- Future: Will reward users with consistent tracking history
- Requires multiple data points over the driver's `stability_requirement` period

## Confidence Thresholds

| Range | Label | UI Color |
|-------|-------|----------|
| 0-39% | Low | Orange |
| 40-69% | Medium | Blue |
| 70-100% | High | Green |

## Domain-Specific Rules

### Metabolism
- **Hard cap at 40%** if no actual lab biomarker values (ApoB, HbA1c, hs-CRP)
- Self-report metabolic health alone cannot achieve Medium/High confidence

### Mind
- **Hard cap at 35%** without a Focus Check test result
- Self-report mood/cognition alone stays Low confidence

### Frame
- **Capped below High (69%)** with only photo/image estimates
- Needs device data (smart scale) or measured data for High confidence

### Recovery
- **Boosted to High (70%+)** when device sleep data (Apple Watch) is present
- Recognizes that sleep trackers provide comprehensive recovery data

## Driver Weights by Domain

### Heart (20% of Prime Score)
| Driver | Weight |
|--------|--------|
| Blood Pressure | 0.35 |
| VO2 Max | 0.35 |
| Resting Heart Rate | 0.15 |
| HRV | 0.15 |

### Frame (20% of Prime Score)
| Driver | Weight |
|--------|--------|
| Body Fat % | 0.35 |
| Waist-to-Height Ratio | 0.25 |
| Lean Body Mass | 0.20 |
| BMI (fallback) | 0.20 |

*Note: BMI is suppressed when body_fat or waist_to_height data is present.*

### Metabolism (20% of Prime Score)
| Driver | Weight |
|--------|--------|
| ApoB | 0.35 |
| HbA1c | 0.35 |
| hs-CRP | 0.15 |
| Metabolic Health (self-report) | 0.15 |

### Recovery (20% of Prime Score)
| Driver | Weight | Source |
|--------|--------|--------|
| Sleep Duration | 0.45 | Device |
| HRV | 0.30 | Device |
| Sleep Regularity | 0.15 | Self-report |
| Insomnia Frequency | 0.10 | Self-report |

*Device-measurable metrics = 75% weight*

### Mind (20% of Prime Score)
| Driver | Weight |
|--------|--------|
| Focus Check | 0.50 |
| Mood | 0.25 |
| Stress | 0.25 |

## Code Location

- Main calculation: `lib/prime-scorecard/scoring/domain-confidence.ts`
- Source multipliers: `lib/prime-scorecard/scoring/types.ts`
- Driver weights: `lib/prime-scorecard/scoring/driver-registry.json`

## Example Calculations

### Recovery with Apple Watch
- Coverage: 0.75 (sleep_duration + hrv)
- Quality: 0.8 (device)
- Freshness: 1.0 (recent)
- Stability: 0 (no baseline)

```
Raw = 100 × (0.35×0.75 + 0.25×0.8 + 0.25×1.0 + 0.15×0)
    = 100 × (0.2625 + 0.2 + 0.25)
    = 71.25%
```

Plus device sleep boost → **High confidence (71%+)**

### Metabolism with self-report only
- Coverage: 0.15 (metabolic_health proxy)
- Quality: 0.4 (self-report)
- Freshness: 1.0 (recent)
- Stability: 0

```
Raw = 100 × (0.35×0.15 + 0.25×0.4 + 0.25×1.0 + 0.15×0)
    = 100 × (0.0525 + 0.1 + 0.25)
    = 40.25%
```

Capped at 40% (no biomarkers) → **Low confidence (40%)**

