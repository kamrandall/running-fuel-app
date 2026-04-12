export const BUILT_IN_FUELS = [
  {
    key: "neversecond-c30",
    name: "Neversecond C30",
    carbsPerServing: 30,
    sodiumPerServing: 200,
    calories: 120,
    servingSizeGrams: 45,
    transportType: "dual",
    notes: "2:1 maltodextrin to fructose ratio with unusually high sodium for runners who sweat heavily."
  },
  {
    key: "maurten-gel-100",
    name: "Maurten Gel 100",
    carbsPerServing: 25,
    sodiumPerServing: 20,
    calories: 100,
    servingSizeGrams: 40,
    transportType: "dual",
    notes: "Hydrogel format with very low sodium. Strong choice for gut comfort but usually needs separate electrolytes."
  },
  {
    key: "maurten-gel-160",
    name: "Maurten Gel 160",
    carbsPerServing: 40,
    sodiumPerServing: 40,
    calories: 160,
    servingSizeGrams: 65,
    transportType: "dual",
    notes: "High-density hydrogel option that reduces packet count when targeting 60 to 90 grams per hour."
  },
  {
    key: "sis-go-isotonic",
    name: "SiS GO Isotonic",
    carbsPerServing: 22,
    sodiumPerServing: 20,
    calories: 87,
    servingSizeGrams: 60,
    transportType: "single",
    notes: "Isotonic gel that is friendly for beginners, but it is less practical for very high carbohydrate targets."
  },
  {
    key: "sis-beta-fuel",
    name: "SiS Beta Fuel",
    carbsPerServing: 40,
    sodiumPerServing: 35,
    calories: 158,
    servingSizeGrams: 60,
    transportType: "dual",
    notes: "1:0.8 maltodextrin to fructose blend designed for 80 to 120 grams per hour with practiced guts."
  }
];

export const STORAGE_KEYS = {
  profile: "running-fuel-profile",
  lastRun: "running-fuel-last-run",
  hyroxProfile: "hyrox-fuel-profile",
  hyroxLastPlan: "hyrox-fuel-last-plan",
  activeTab: "running-fuel-active-tab"
};

export const RUN_TYPE_LABELS = {
  easy: "Easy",
  recovery: "Recovery",
  tempo: "Tempo",
  interval: "Interval",
  long: "Long",
  race: "Race"
};

export const SWEAT_RATE_OPTIONS = [
  { value: 0.8, label: "Default average (0.8 L/hr)" },
  { value: 0.6, label: "Lower sweat rate (0.6 L/hr)" },
  { value: 1.0, label: "Moderately high (1.0 L/hr)" },
  { value: 1.2, label: "High sweat rate (1.2 L/hr)" },
  { value: 1.5, label: "Very high sweat rate (1.5 L/hr)" },
  { value: 1.8, label: "Extreme heat/heavy sweater (1.8 L/hr)" }
];

export const GUT_TOLERANCE_OPTIONS = [
  { value: 60, label: "Default average (60 g/hr)" },
  { value: 30, label: "Cautious beginner (30 g/hr)" },
  { value: 45, label: "Developing tolerance (45 g/hr)" },
  { value: 75, label: "Trained tolerance (75 g/hr)" },
  { value: 90, label: "Advanced dual-source intake (90 g/hr)" },
  { value: 100, label: "Elite gut training (100 g/hr)" }
];

export const PACE_OPTIONS = [
  { value: 3.25, label: "03:00 - 03:30 /km" },
  { value: 3.75, label: "03:30 - 04:00 /km" },
  { value: 4.25, label: "04:00 - 04:30 /km" },
  { value: 4.75, label: "04:30 - 05:00 /km" },
  { value: 5.25, label: "05:00 - 05:30 /km" },
  { value: 5.75, label: "05:30 - 06:00 /km" },
  { value: 6.25, label: "06:00 - 06:30 /km" },
  { value: 6.75, label: "06:30 - 07:00 /km" },
  { value: 7.25, label: "07:00 - 07:30 /km" },
  { value: 7.75, label: "07:30 - 08:00 /km" },
  { value: 8.25, label: "08:00 - 08:30 /km" },
  { value: 8.75, label: "08:30 - 09:00 /km" },
  { value: 9.25, label: "09:00 - 09:30 /km" },
  { value: 9.75, label: "09:30 - 10:00 /km" }
];

export const HYROX_STATIONS = [
  { key: "ski", name: "Station 1 · SkiErg", maleDefaultMinutes: 4.2, femaleDefaultMinutes: 4.4 },
  { key: "sledPush", name: "Station 2 · Sled Push", maleDefaultMinutes: 3.4, femaleDefaultMinutes: 3.0 },
  { key: "sledPull", name: "Station 3 · Sled Pull", maleDefaultMinutes: 3.2, femaleDefaultMinutes: 2.9 },
  { key: "burpees", name: "Station 4 · Burpee Broad Jumps", maleDefaultMinutes: 4.8, femaleDefaultMinutes: 4.8 },
  { key: "row", name: "Station 5 · Row", maleDefaultMinutes: 4.1, femaleDefaultMinutes: 4.3 },
  { key: "farmersCarry", name: "Station 6 · Farmers Carry", maleDefaultMinutes: 2.1, femaleDefaultMinutes: 2.2 },
  { key: "lunges", name: "Station 7 · Sandbag Lunges", maleDefaultMinutes: 4.1, femaleDefaultMinutes: 4.0 },
  { key: "wallBalls", name: "Station 8 · Wall Balls", maleDefaultMinutes: 5.1, femaleDefaultMinutes: 4.5 }
];
