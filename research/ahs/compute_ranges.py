"""Compute renovation cost ranges from the AHS 2023 National PUF.

Usage:
  python3 -I compute_ranges.py <project.csv> <household.csv> <out.json> <checks.json>

Only the standard library is used. Weighted percentiles follow the SAS PROC
UNIVARIATE weighted definition (the method behind AHS Table Creator medians).
Margins of error use the 160 Fay replicate weights: var = 4/160 * sum((r - full)^2),
MOE90 = 1.645 * sqrt(var).
"""

import csv
import json
import math
import sys
from collections import Counter, defaultdict

MIN_N = 50
N_REPS = 160
FAY_FACTOR = 4.0 / N_REPS
Z90 = 1.645

SURVEY_URL = (
    "https://www2.census.gov/programs-surveys/ahs/2023/"
    "AHS%202023%20National%20PUF%20v1.1%20CSV.zip"
)
CODEBOOK_URLS = [
    "https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20Value%20Labels%20Package.zip",
    "https://www2.census.gov/programs-surveys/ahs/2023/2023__AHS_Items_Booklet.pdf",
    "https://www2.census.gov/programs-surveys/ahs/2023/2023%20AHS%20Definitions.pdf",
    "https://www2.census.gov/programs-surveys/ahs/2023/"
    "AHS%202023%20Table%20Specifications%20and%20PUF%20Estimates%20for%20User%20Verification.xlsx",
    "https://www.census.gov/programs-surveys/ahs/tech-documentation/codebooks/ahs-codebook-tool.html",
]

JOBTYPE_LABELS = {
    "07": "Added bedroom or converted existing space to bedroom",
    "08": "Added bathroom or converted existing space to bathroom",
    "09": "Added recreation room or converted existing space to recreation room",
    "10": "Added kitchen or converted existing space to kitchen",
    "11": "Added other room or converted existing space to other room",
    "12": "Remodeled bathroom",
    "13": "Remodeled kitchen",
    "15": "Added porch, deck, patio, or terrace",
    "16": "Added or replaced roofing",
    "18": "Added or replaced doors or windows",
    "20": "Added or replaced insulation",
    "26": "Added or replaced central air conditioning",
    "27": "Added or replaced built-in heating equipment",
    "32": "Added or replaced driveways or walkways",
    "33": "Added or replaced fencing or walls",
    "36": "Added or replaced landscaping or sprinkler system",
}

CARDS = {
    "kitchen": ["13"],
    "bathroom": ["12"],
    "roofHvac": ["16", "26", "27"],
    "aduAddition": ["07", "08", "09", "10", "11"],
    "outdoor": ["15", "32", "33", "36"],
    "solarEnergy": ["18", "20"],
    "agingInPlace": [],
}

DIVISIONS = {
    "1": "New England",
    "2": "Middle Atlantic",
    "3": "East North Central",
    "4": "West North Central",
    "5": "South Atlantic",
    "6": "East South Central",
    "7": "West South Central",
    "8": "Mountain",
    "9": "Pacific",
}

# Top-15 metros identified on the 2023 National PUF (OMB13CBSA), with the states
# each MSA spans (first = principal state in the CBSA title) and 2020 Census MSA
# population (used only to rank metros within a state).
METROS = {
    "35620": ("New York-Newark-Jersey City, NY-NJ-PA", ["NY", "NJ", "PA"], 20140470),
    "31080": ("Los Angeles-Long Beach-Anaheim, CA", ["CA"], 13200998),
    "16980": ("Chicago-Naperville-Elgin, IL-IN-WI", ["IL", "IN", "WI"], 9618502),
    "19100": ("Dallas-Fort Worth-Arlington, TX", ["TX"], 7637387),
    "26420": ("Houston-The Woodlands-Sugar Land, TX", ["TX"], 7122240),
    "47900": ("Washington-Arlington-Alexandria, DC-VA-MD-WV", ["DC", "VA", "MD", "WV"], 6385162),
    "37980": ("Philadelphia-Camden-Wilmington, PA-NJ-DE-MD", ["PA", "NJ", "DE", "MD"], 6245051),
    "33100": ("Miami-Fort Lauderdale-West Palm Beach, FL", ["FL"], 6138333),
    "12060": ("Atlanta-Sandy Springs-Roswell, GA", ["GA"], 6089815),
    "14460": ("Boston-Cambridge-Newton, MA-NH", ["MA", "NH"], 4941632),
    "38060": ("Phoenix-Mesa-Scottsdale, AZ", ["AZ"], 4845832),
    "41860": ("San Francisco-Oakland-Hayward, CA", ["CA"], 4749008),
    "40140": ("Riverside-San Bernardino-Ontario, CA", ["CA"], 4599839),
    "19820": ("Detroit-Warren-Dearborn, MI", ["MI"], 4392041),
    "42660": ("Seattle-Tacoma-Bellevue, WA", ["WA"], 4018762),
}

STATE_DIVISION = {
    "CT": "1", "MA": "1",
    "NJ": "2", "NY": "2", "PA": "2",
    "IL": "3", "IN": "3", "MI": "3", "OH": "3", "WI": "3",
    "MN": "4", "MO": "4",
    "DC": "5", "FL": "5", "GA": "5", "MD": "5", "NC": "5", "SC": "5", "VA": "5",
    "KY": "6", "TN": "6",
    "AZ": "8", "CO": "8", "NV": "8", "UT": "8",
    "CA": "9", "HI": "9", "OR": "9", "WA": "9",
}
TARGET_STATES = sorted(STATE_DIVISION)


def clean(value):
    return value.strip().strip("'").strip('"')


def weighted_percentile(pairs, p):
    """SAS PROC UNIVARIATE weighted percentile. pairs: sorted list of (x, w)."""
    total = sum(w for _, w in pairs)
    target = p * total
    cum = 0.0
    eps = 1e-9 * total
    for i, (x, w) in enumerate(pairs):
        prev = cum
        cum += w
        if abs(cum - target) <= eps and i + 1 < len(pairs):
            return (x + pairs[i + 1][0]) / 2.0
        if prev < target < cum or (abs(prev - target) <= eps and i == 0):
            return x
    return pairs[-1][0]


def round100(value):
    if value is None:
        return None
    return int(math.floor(value / 100.0 + 0.5) * 100)


def load_households(household_path, controls):
    """Return {CONTROL: dict(weight, division, cbsa, reps)} for project households."""
    out = {}
    with open(household_path, newline="") as f:
        rdr = csv.reader(f)
        hdr = next(rdr)
        idx = {k: hdr.index(k) for k in ["CONTROL", "WEIGHT", "DIVISION", "OMB13CBSA", "TENURE", "INTSTATUS"]}
        rep_idx = [hdr.index(f"REPWEIGHT{i}") for i in range(1, N_REPS + 1)]
        for row in rdr:
            ctrl = clean(row[idx["CONTROL"]])
            if ctrl not in controls:
                continue
            out[ctrl] = {
                "weight": float(clean(row[idx["WEIGHT"]])),
                "division": clean(row[idx["DIVISION"]]),
                "cbsa": clean(row[idx["OMB13CBSA"]]),
                "tenure": clean(row[idx["TENURE"]]),
                "intstatus": clean(row[idx["INTSTATUS"]]),
                "reps": [float(clean(row[i])) for i in rep_idx],
            }
    return out


def load_jobs(project_path, household_path):
    with open(project_path, newline="") as f:
        raw = list(csv.DictReader(f))
    controls = {clean(r["CONTROL"]) for r in raw}
    hh = load_households(household_path, controls)
    jobs = []
    for r in raw:
        h = hh[clean(r["CONTROL"])]
        jobs.append({
            "jobtype": clean(r["JOBTYPE"]),
            "cost": int(clean(r["JOBCOST"])),
            "diy": clean(r["JOBDIY"]),
            "comp": clean(r["JOBCOMP"]),
            "compyr": clean(r["JOBCOMPYR"]),
            "workyr": clean(r["JOBWORKYR"]),
            "jcost": clean(r["JJOBCOST"]),
            "jdiy": clean(r["JJOBDIY"]),
            **h,
        })
    return jobs


def stats_for(jobs, with_moe=False):
    """Weighted p25/p50/p75 of JOBCOST over jobs with JOBCOST > 0."""
    valid = [j for j in jobs if j["cost"] > 0]
    n = len(valid)
    cell = {"p25": None, "p50": None, "p75": None, "n": n}
    if n < MIN_N:
        return cell
    pairs = sorted((j["cost"], j["weight"]) for j in valid)
    raw = {p: weighted_percentile(pairs, q) for p, q in (("p25", 0.25), ("p50", 0.50), ("p75", 0.75))}
    for key, value in raw.items():
        cell[key] = round100(value)
    if with_moe:
        full = raw["p50"]
        sq = 0.0
        for r in range(N_REPS):
            rp = sorted((j["cost"], j["reps"][r]) for j in valid)
            sq += (weighted_percentile(rp, 0.5) - full) ** 2
        cell["p50Moe90"] = round100(Z90 * math.sqrt(FAY_FACTOR * sq))
    return cell


def card_jobs(jobs, card):
    codes = set(CARDS[card])
    return [j for j in jobs if j["jobtype"] in codes]


def card_block(jobs, with_moe):
    block = {}
    for card in CARDS:
        if not CARDS[card]:
            block[card] = None
            continue
        sel = card_jobs(jobs, card)
        block[card] = {
            "pro": stats_for([j for j in sel if j["diy"] == "2"], with_moe),
            "all": stats_for(sel, with_moe),
        }
    return block


def state_metro(state):
    """Largest identified metro whose principal (first-named) state is `state`."""
    cands = [(pop, code) for code, (_, states, pop) in METROS.items() if states[0] == state]
    if not cands:
        return None
    return max(cands)[1]


def build_states(national, divisions, metros):
    out = {}
    for st in TARGET_STATES:
        div_name = DIVISIONS[STATE_DIVISION[st]]
        metro_code = state_metro(st)
        metro_name = METROS[metro_code][0] if metro_code else None
        out[st] = {}
        for card in CARDS:
            if not CARDS[card]:
                out[st][card] = None
                continue
            chosen, basis = None, None
            if metro_name:
                cell = metros[metro_name][card]["pro"]
                if cell["n"] >= MIN_N:
                    chosen, basis = cell, f"{metro_name} metro"
            if chosen is None:
                cell = divisions[div_name][card]["pro"]
                if cell["n"] >= MIN_N:
                    chosen, basis = cell, f"{div_name} division"
            if chosen is None:
                chosen, basis = national[card]["pro"], f"National ({div_name} division below {MIN_N} jobs)"
            out[st][card] = {k: chosen[k] for k in ("p25", "p50", "p75", "n")}
            out[st][card]["basis"] = basis
    return out


def census_replication(jobs):
    """Replicate Table C-16-OO medians: JOBCOST > 0, JOBDIY in (1,2), WEIGHT, by JOBTYPE."""
    groups = defaultdict(list)
    for j in jobs:
        groups[j["jobtype"]].append(j)
    groups["26+27"] = [j for j in jobs if j["jobtype"] in ("26", "27")]
    groups["ALL"] = list(jobs)
    out = {}
    for key, sel in sorted(groups.items()):
        valid = sorted((j["cost"], j["weight"]) for j in sel if j["cost"] > 0)
        pro = sorted((j["cost"], j["weight"]) for j in sel if j["cost"] > 0 and j["diy"] == "2")
        out[key] = {
            "projects_thousands": round(sum(j["weight"] for j in sel) / 1000.0),
            "median_all": weighted_percentile(valid, 0.5) if valid else None,
            "median_pro": weighted_percentile(pro, 0.5) if pro else None,
            "n_all": len(valid),
            "n_pro": len(pro),
        }
    return out


def sensitivity(jobs):
    """National pro medians under alternative filters."""
    variants = {
        "baseline": lambda j: True,
        "completedOnly": lambda j: j["comp"] == "1",
        "excludeImputedCost": lambda j: j["jcost"] == "0",
        "workYear2022or2023": lambda j: (j["compyr"] in ("2", "3")) or (j["workyr"] in ("2", "3")),
    }
    out = {}
    for name, keep in variants.items():
        out[name] = {}
        for card in CARDS:
            if not CARDS[card]:
                continue
            sel = [j for j in card_jobs(jobs, card) if j["diy"] == "2" and keep(j)]
            out[name][card] = stats_for(sel)
    sel = [j for j in jobs if j["jobtype"] in ("10", "13") and j["diy"] == "2"]
    out["kitchenIncludingAddedKitchen"] = stats_for(sel)
    return out


def descriptives(jobs):
    year = Counter()
    for j in jobs:
        y = j["compyr"] if j["compyr"] in ("1", "2", "3") else j["workyr"]
        year[{"1": "2021", "2": "2022", "3": "2023"}.get(y, "not reported")] += 1
    return {
        "projectRecords": len(jobs),
        "ownerOccupiedCheck": dict(Counter(f"INTSTATUS={j['intstatus']},TENURE={j['tenure']}" for j in jobs)),
        "jobcostSpecial": {
            "missing(-9)": sum(1 for j in jobs if j["cost"] < 0),
            "zero(free)": sum(1 for j in jobs if j["cost"] == 0),
        },
        "jjobcostFlags": dict(Counter(j["jcost"] for j in jobs)),
        "jobdiy": dict(Counter(j["diy"] for j in jobs)),
        "primaryYear": dict(year),
        "incomplete": sum(1 for j in jobs if j["comp"] == "2"),
    }


def main(project_path, household_path, out_path, checks_path):
    jobs = load_jobs(project_path, household_path)
    jobs = [j for j in jobs if j["intstatus"] == "1" and j["tenure"] == "1" and j["diy"] in ("1", "2")]

    national = card_block(jobs, with_moe=True)
    divisions = {}
    for code, name in DIVISIONS.items():
        divisions[name] = card_block([j for j in jobs if j["division"] == code], with_moe=True)
    metros = {}
    for code, (name, states, _) in sorted(METROS.items(), key=lambda kv: -kv[1][2]):
        if not any(s in STATE_DIVISION for s in states):
            continue
        metros[name] = card_block([j for j in jobs if j["cbsa"] == code], with_moe=True)
    states = build_states(national, divisions, metros)

    result = {
        "meta": {
            "survey": "AHS 2023 National PUF (v1.1, CSV)",
            "source": "Point analysis of U.S. Census Bureau American Housing Survey data",
            "url": SURVEY_URL,
            "codebookUrl": CODEBOOK_URLS[0],
            "documentation": CODEBOOK_URLS[1:],
            "weight": "WEIGHT (household final weight, household.csv) joined to project.csv on CONTROL; "
                      "project records carry no weight of their own. Not a topical-module item, so "
                      "SP1WEIGHT/SP2WEIGHT do not apply. MOEs use REPWEIGHT1-160 (Fay, 4/160).",
            "universe": "Owner-occupied units (INTSTATUS=1, TENURE=1); every project record is in this universe.",
            "jobFilter": "JOBDIY=2 ('did someone in your household do most of the work?' = No) for 'pro'; "
                         "JOBDIY in (1,2) for 'all'. JOBCOST > 0 (excludes 0 = free job and -9 = not reported). "
                         "Includes imputed costs (JJOBCOST=2, 15% of records) and incomplete jobs "
                         "(JOBCOMP=2, 6%), matching Census Table C-16-OO.",
            "percentileMethod": "Weighted percentiles, SAS PROC UNIVARIATE weighted definition; "
                                "rounded to nearest $100.",
            "costYears": "Jobs done in the two years before the 2023 interview: primary year 2021, 2022 "
                         "or 2023 (JOBCOMPYR for completed jobs, JOBWORKYR for incomplete). Nominal dollars, "
                         "not inflation-adjusted. Cost = respondent-reported cost of the entire job, including "
                         "insurance-covered amounts, excluding own time.",
            "topCoding": "JOBCOST is topcoded on the PUF: values at/above a topcode are replaced by the mean of "
                         "those values (at least 3 cases), computed separately for each of the 15 identified "
                         "metros and for the rest of the country; the highest value on file is $241,000 "
                         "(range of topcoded values $82,000-$241,000). PUF costs are also rounded "
                         "($1,000-$49,999 to nearest $100; $50,000+ to nearest $1,000). No 999998 cap values "
                         "occur. Top-15-metro records also carry disclosure noise.",
            "suppression": f"Cells with fewer than {MIN_N} unweighted jobs with JOBCOST > 0 keep n and set "
                           "p25/p50/p75 to null.",
            "geography": "No state identifier on the National PUF (STATE is internal-use only). Geography is "
                         "DIVISION (9 Census divisions) and OMB13CBSA (15 largest metros; 99998 = other metro, "
                         "99999 = non-metro).",
            "stateRule": "Metro = largest identified metro whose principal (first-named) state in the CBSA "
                         f"title is the state, used when it has >= {MIN_N} professional jobs for the card; "
                         "otherwise the state's Census division.",
            "agingInPlace": "AHS has no accessibility job type. HMRACCESS is a household-level yes/no "
                            "('did you do any of these improvements to make your home more accessible...') "
                            "that cannot be tied to a specific job, so this card is null.",
            "solar": "AHS has no solar job type; solarEnergy covers doors/windows (18) and insulation (20) only.",
        },
        "cardMapping": {card: [f"{c}: {JOBTYPE_LABELS[c]}" for c in codes] for card, codes in CARDS.items()},
        "national": national,
        "divisions": divisions,
        "metros": metros,
        "states": states,
    }
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    checks = {
        "descriptives": descriptives(jobs),
        "censusReplication": census_replication(jobs),
        "sensitivity": sensitivity(jobs),
    }
    with open(checks_path, "w") as f:
        json.dump(checks, f, indent=2)


if __name__ == "__main__":
    main(*sys.argv[1:5])
