// Home reno page data (/home-reno). Snapshot updated by hand, then redeployed. Method and sources: RENO_COSTS.md
// homeImprovementAvg: Point funded HEIs whose use of funds includes home improvement, Sep 2025 - Aug 2026, rounded to the nearest $1,000.
// null where the state had fewer than 30 such HEIs in the window.

export const RENO_SOURCES = {
  point: { label: "Point funded HEIs, Sep 2025 - Aug 2026", table: "ANALYTICS.MASTER_REPORTING.HEI_CONTRACTS", pulled: "2026-10-28" },
  fhfa: { label: "FHFA House Price Index", url: "https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_po_state.txt", published: "2026-08" },
};

export const RENO_STATE_DATA = {
  AZ: { homeImprovementAvg: 87000, homeValueChange5yr: { pct: 27.5, source: "fhfa" } },
  CA: { homeImprovementAvg: 124000, homeValueChange5yr: { pct: 17.3, source: "fhfa" } },
  CO: { homeImprovementAvg: 84000, homeValueChange5yr: { pct: 16.0, source: "fhfa" } },
  CT: { homeImprovementAvg: 76000, homeValueChange5yr: { pct: 49.6, source: "fhfa" } },
  DC: { homeImprovementAvg: null, homeValueChange5yr: { pct: -2.3, source: "fhfa" } },
  FL: { homeImprovementAvg: 80000, homeValueChange5yr: { pct: 37.5, source: "fhfa" } },
  GA: { homeImprovementAvg: 70000, homeValueChange5yr: { pct: 39.2, source: "fhfa" } },
  HI: { homeImprovementAvg: null, homeValueChange5yr: { pct: 38.0, source: "fhfa" } },
  IL: { homeImprovementAvg: 62000, homeValueChange5yr: { pct: 44.0, source: "fhfa" } },
  IN: { homeImprovementAvg: 54000, homeValueChange5yr: { pct: 39.4, source: "fhfa" } },
  KY: { homeImprovementAvg: null, homeValueChange5yr: { pct: 39.5, source: "fhfa" } },
  MA: { homeImprovementAvg: null, homeValueChange5yr: { pct: 35.0, source: "fhfa" } },
  MD: { homeImprovementAvg: 77000, homeValueChange5yr: { pct: 25.6, source: "fhfa" } },
  MI: { homeImprovementAvg: 58000, homeValueChange5yr: { pct: 38.8, source: "fhfa" } },
  MN: { homeImprovementAvg: 59000, homeValueChange5yr: { pct: 24.7, source: "fhfa" } },
  MO: { homeImprovementAvg: 53000, homeValueChange5yr: { pct: 38.2, source: "fhfa" } },
  NC: { homeImprovementAvg: 62000, homeValueChange5yr: { pct: 41.2, source: "fhfa" } },
  NJ: { homeImprovementAvg: 86000, homeValueChange5yr: { pct: 50.5, source: "fhfa" } },
  NV: { homeImprovementAvg: 85000, homeValueChange5yr: { pct: 28.7, source: "fhfa" } },
  NY: { homeImprovementAvg: 104000, homeValueChange5yr: { pct: 44.0, source: "fhfa" } },
  OH: { homeImprovementAvg: 51000, homeValueChange5yr: { pct: 41.9, source: "fhfa" } },
  OR: { homeImprovementAvg: 87000, homeValueChange5yr: { pct: 15.8, source: "fhfa" } },
  PA: { homeImprovementAvg: 64000, homeValueChange5yr: { pct: 37.2, source: "fhfa" } },
  SC: { homeImprovementAvg: 67000, homeValueChange5yr: { pct: 45.4, source: "fhfa" } },
  TN: { homeImprovementAvg: 68000, homeValueChange5yr: { pct: 38.4, source: "fhfa" } },
  UT: { homeImprovementAvg: 91000, homeValueChange5yr: { pct: 24.0, source: "fhfa" } },
  VA: { homeImprovementAvg: 70000, homeValueChange5yr: { pct: 37.3, source: "fhfa" } },
  WA: { homeImprovementAvg: 96000, homeValueChange5yr: { pct: 20.0, source: "fhfa" } },
  WI: { homeImprovementAvg: 60000, homeValueChange5yr: { pct: 46.0, source: "fhfa" } },
};
