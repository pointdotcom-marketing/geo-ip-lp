# Renovation cost ranges from the AHS 2023 National PUF

Source line for the page: **Point analysis of U.S. Census Bureau American Housing Survey data** (AHS 2023, public use file).

Data: `ahs-ranges.json` (same folder). Script: `compute_ranges.py` (same folder). It writes `ahs-ranges.json` and `checks.json`, which holds the Census replication and the sensitivity runs. The raw PUF is not kept in the repo.

To reproduce, download and unzip the PUF, then run:

```
python3 -I compute_ranges.py <puf>/project.csv <puf>/household.csv ahs-ranges.json checks.json
```

## National figures (professional jobs, JOBDIY = 2)

| Card | p25 | Median | p75 | Median MOE (90%) | Jobs (n) | All-jobs median (DIY included) |
|---|---|---|---|---|---|---|
| kitchen | $5,000 | $12,000 | $25,000 | ±$2,000 | 979 | $8,000 |
| bathroom | $4,000 | $8,000 | $14,700 | ±$400 | 1,421 | $5,000 |
| roofHvac | $4,000 | $7,000 | $12,000 | ±$100 | 5,819 | $7,000 |
| aduAddition | $7,000 | $20,000 | $45,000 | ±$2,600 | 387 | $10,000 |
| outdoor | $1,800 | $3,800 | $7,800 | ±$400 | 3,982 | $2,200 |
| solarEnergy | $1,500 | $3,500 | $8,000 | ±$200 | 2,310 | $2,000 |
| agingInPlace | null | null | null | | | null |

Dollars are nominal for 2021 to 2023, rounded to the nearest $100. n is the unweighted count of jobs with a reported cost above $0.

## Data and variables

- File: AHS 2023 National PUF v1.1, CSV (`project.csv`, `household.csv`), https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20National%20PUF%20v1.1%20CSV.zip
- Documentation used: the 2023 Value Labels Package, the 2023 Items Booklet (question wording), the 2023 AHS Definitions, the Table Specifications and PUF Estimates for User Verification workbook, and the Census guides to disclosure avoidance and imputation.
- `project.csv` (44,689 job records), with these variables:
  - `JOBTYPE`: job type, codes 01 to 37.
  - `JOBCOST`: cost of the entire job, including any amount insurance covered and excluding the owner's own time. A value of 0 means the job was free and -9 means it was not reported.
  - `JOBDIY`: "Did someone in your household do most of the work?" 1 = yes (DIY), 2 = no. Census labels 2 as "Professional".
  - `JOBCOMP`, `JOBCOMPYR`, `JOBWORKYR`: whether the job is complete, and its main year.
  - `JJOBCOST`, `JJOBDIY`: edit and imputation flags.
- Join: `project.CONTROL` to `household.CONTROL`. Project records have no weight of their own.
- Weight: `WEIGHT`, the household final weight. Home improvement is not a topical module, so `SP1WEIGHT` and `SP2WEIGHT` don't apply. Margins of error use `REPWEIGHT1` to `REPWEIGHT160` (Fay's method: variance = 4/160 × Σ(replicate − full)², MOE = 1.645 × SE).
- Universe: owner-occupied units (`INTSTATUS` = 1, `TENURE` = 1). Every project record falls in this universe.
- Geography:
  - `DIVISION`: the 9 Census divisions.
  - `OMB13CBSA`: the 15 largest metros. 99998 means another metro and 99999 means non-metro.
  - There is **no state identifier** on the PUF. STATE is only on the internal-use file.

## Method

1. Filters:
   - All jobs: `JOBDIY` in (1, 2) and `JOBCOST` > 0. This drops 1,907 free jobs and 79 jobs with no reported cost, which is the same filter Census uses for Table C-16-OO.
   - Professional jobs: the same filter with `JOBDIY` = 2.
2. Percentiles are weighted with the SAS PROC UNIVARIATE weighted definition, which is what Census uses ("proc univariate of JOBCOST").
3. A cell with fewer than 50 unweighted jobs keeps its `n` and has p25, p50 and p75 set to null.
4. Imputed costs (`JJOBCOST` = 2, 15% of records) and incomplete jobs (`JOBCOMP` = 2, 6% of records) are included, as they are in the Census tables. The sensitivity section below shows what changes without them.
5. Combined jobs: each project record carries exactly one `JOBTYPE`. The questionnaire lets a respondent enter "1" when a job's cost was already included in another job's amount, but no `JOBCOST` = 1 values appear on the PUF. Census's imputation note says these costs are hot-decked ("weighted median of combined home improvement job costs"), so they show up as imputed values. Each record is therefore assigned to exactly one card and no record is counted twice. The only repeated (household, type) pairs are codes 31 and 37 ("other" jobs, up to three each), and neither code is used here.

## Card to AHS code mapping

- **kitchen**: 13 Remodeled kitchen. Code 10 (added kitchen) goes in aduAddition so that no job is counted in two cards. With code 10 included, the professional kitchen median would be $13,100 instead of $12,000.
- **bathroom**: 12 Remodeled bathroom.
- **roofHvac**: 16 Added or replaced roofing; 26 central air conditioning; 27 built-in heating equipment. AHS has no separate heat-pump code, so heat pumps fall under 26 or 27.
- **aduAddition**: 07 bedroom, 08 bathroom, 09 recreation room, 10 kitchen, 11 other room (each "added, or converted existing space to"). Garage, attic and basement conversions have no codes of their own. They are captured by the "converted existing space" wording of codes 07 to 11.
  - Excluded: 14 attached garage or carport (not living space) and 35 shed or detached garage (mostly sheds).
- **outdoor**: 15 porch, deck, patio or terrace; 32 driveways or walkways; 33 fencing or walls; 36 landscaping or sprinkler system.
  - Excluded: 34 pools and tennis courts, and 37 other lot or yard jobs.
- **solarEnergy**: 18 doors or windows; 20 insulation. **AHS has no solar job type.** HVAC is already in roofHvac.
  - `HMRENEFF` (whether "any of these" improvements were for energy efficiency) is a household-level flag and can't be tied to individual jobs.
- **agingInPlace**: null. AHS has no accessibility job type.
  - `HMRACCESS` is a household-level yes/no. 1,015 of 16,523 project households answered yes, but the answer can't be attributed to a specific job.

## Geographies and the state rule

- Divisions: all 9 are computed.
- Metros: the 13 identified metros in the 29 target states. Dallas and Houston are left out because TX is not a target state.
- State rule: a state uses its largest identified metro whose **principal (first-named) state** is that state, when that metro has at least 50 professional jobs for the card. Otherwise the state uses its Census division. If the division also has fewer than 50, the state uses the national figure, and the `basis` field says so.
  - Principal-state metros: NY (New York), CA (Los Angeles), IL (Chicago), DC (Washington), PA (Philadelphia), FL (Miami), GA (Atlanta), MA (Boston), AZ (Phoenix), MI (Detroit), WA (Seattle).
  - NJ, MD, VA, IN and WI each contain part of an identified metro but are not its first-named state, so they use their divisions. Assigning the New York metro to NJ, or the Washington metro to MD and VA, would apply suburban-core costs to a whole state.

Number of states using each basis (29 states):

| Card | Metro | Division | National |
|---|---|---|---|
| kitchen | 1 (DC) | 24 | 4 (KY, TN, MN, MO) |
| bathroom | 9 | 16 | 4 (KY, TN, MN, MO) |
| roofHvac | 11 | 18 | 0 |
| aduAddition | 0 | 11 (South Atlantic and Pacific states) | 18 |
| outdoor | 11 | 18 | 0 |
| solarEnergy | 11 | 18 | 0 |
| agingInPlace | null | null | null |

## Sanity check against published Census figures

I replicated Census Table C-16-OO ("Home Improvement Costs", owner-occupied, 2023) from the PUF and compared it with the "PUF estimate" column of Census's own verification workbook. **The results match exactly for every job type**, including these:

| Job type | Medians in this analysis | Census |
|---|---|---|
| Kitchen remodel (13), all jobs | $8,000 | $8,000 |
| Bath remodel (12) | $5,000 | $5,000 |
| Roofing (16) | $10,000 | $10,000 |
| AC and heating (26+27) | $5,500 | $5,500 |
| All jobs | $2,000 | $2,000 |
| Project count (thousands) | 139,946 | 139,946 |

- The professional-only kitchen median comes out at **$12,000**, matching the figure reported from the Table Creator's "Professional" by-group (`JOBDIY` = 2).
- The replicate-weight MOE for the kitchen median is ±$1,000. Census publishes ±$1,019.
- Table Creator itself differs from the PUF in a few small cells: added bath $10,130 vs $14,200, added kitchen $25,000 vs $30,000, recreation room $10,000 vs $16,000. Census attributes the differences to PUF topcoding and rounding. These small cells are inside aduAddition.

## Sensitivity (national professional medians)

| Variant | kitchen | bathroom | roofHvac | aduAddition | outdoor | solarEnergy |
|---|---|---|---|---|---|---|
| Baseline | $12,000 | $8,000 | $7,000 | $20,000 | $3,800 | $3,500 |
| Completed jobs only | $13,100 | $8,000 | $7,000 | $19,600 | $3,700 | $3,500 |
| Excluding imputed costs | $10,000 | $7,500 | $7,000 | $20,000 | $4,000 | $3,500 |
| Main year 2022 to 2023 only | $13,700 | $8,000 | $7,000 | $19,600 | $3,800 | $3,700 |

## Caveats

- **Old, nominal dollars.** The figures are 2021 to 2023 costs with no inflation adjustment. Restricting to 2022 and 2023 raises the professional kitchen median to $13,700.
- **Not a contractor quote.** Costs are what owners reported spending, and the respondent defines the scope of each job. A "kitchen remodel" can be anything from a counter swap to a gut renovation, which is why the p25 to p75 ranges are wide.
- **Heaped, coarse values.** Answers cluster at round numbers ($5,000, $10,000), and the PUF rounds costs to $100 or $1,000. Medians move in steps as a result, and some replicate MOEs come out as ±$0 or ±$100. Those figures understate the real uncertainty.
- **Topcoding.** `JOBCOST` is topcoded on the PUF: values at or above a cutoff are replaced by their mean, computed per identified metro and for the rest of the country. Topcoded values range from $82,000 (Los Angeles) to $241,000. Few records are affected, and p25 to p75 are essentially untouched. No $999,998 cap values appear.
- **Small and noisy local cells.** Many metro and division cells sit just above n = 50, with median MOEs of ±$2,000 to ±$6,500. Examples are the Washington metro kitchen median ($16,000 ± $5,300) and New England kitchen ($16,500 ± $6,500). Census also adds disclosure noise to top-15 metro records and advises caution when cross-tabulating more than three variables in metro estimates.
- **aduAddition is national for most states.** Only the South Atlantic and Pacific divisions reach 50 professional jobs, so 18 states show the national range.
- **Division ranges can be a poor proxy.** Hawaii and Oregon get the Pacific figure, which California dominates. Kentucky, Tennessee, Minnesota and Missouri get national kitchen and bathroom figures.
- **roofHvac mixes two cost profiles.** Roofing has a median around $10,000 and HVAC around $6,000. The card's figure depends on the regional mix of the two.
- **Possible extension.** The separate AHS 2023 *Metropolitan* PUF has independent samples for Denver, Cincinnati, Cleveland, Milwaukee and New Orleans, which would cover CO, OH, KY and WI. It was not used, because the brief limited the analysis to the National PUF.
