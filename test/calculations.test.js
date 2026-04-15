import test from "node:test";
import assert from "node:assert/strict";

import { BUILT_IN_FUELS } from "../src/constants.js";
import {
  approximateWBGTC,
  approximateWetBulbC,
  buildGutTrainingPlan,
  buildHyroxPlan,
  buildRunPlan,
  calculateDailyMacros,
  calculateSweatRate,
  clamp,
  computeHeatIndexC,
  estimatePaceMinPerKm,
  estimateDurationMinutes,
  formatClock,
  round,
  roundToNearest
} from "../src/calculations.js";

function assertClose(actual, expected, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

const fuelsByKey = Object.fromEntries(BUILT_IN_FUELS.map((fuel) => [fuel.key, fuel]));

const neversecondC30 = fuelsByKey["neversecond-c30"];
const maurtenGel100 = fuelsByKey["maurten-gel-100"];
const sisGoIsotonic = fuelsByKey["sis-go-isotonic"];
const sisBetaFuel = fuelsByKey["sis-beta-fuel"];

function kitOf(...items) {
  return items.map((item, index) => ({
    ...item.fuel,
    id: item.id ?? `fuel-${index + 1}`,
    quantity: item.quantity ?? 1,
    addedOrder: item.addedOrder ?? index + 1
  }));
}

test("commercial gel constants match the current product database values", () => {
  assert.equal(fuelsByKey["neversecond-c30"].carbsPerServing, 30);
  assert.equal(fuelsByKey["neversecond-c30"].sodiumPerServing, 200);
  assert.equal(fuelsByKey["sis-beta-fuel"].carbsPerServing, 40);
  assert.equal(fuelsByKey["sis-beta-fuel"].sodiumPerServing, 30);
  assert.equal(fuelsByKey["sis-go-isotonic"].carbsPerServing, 22);
  assert.equal(fuelsByKey["sis-go-isotonic"].sodiumPerServing, 10);
  assert.equal(fuelsByKey["maurten-gel-100"].carbsPerServing, 25);
  assert.equal(fuelsByKey["maurten-gel-100"].sodiumPerServing, 20);
});

test("utility math helpers keep their current rounding and formatting behavior", () => {
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(6, 0, 10), 6);

  assert.equal(round(1.235, 2), 1.24);
  assert.equal(roundToNearest(117, 25), 125);
  assert.equal(formatClock(72.5), "01:12:30");
  assert.equal(estimateDurationMinutes({ distanceKm: 10, paceMinPerKm: 5.75 }), 57.5);
  assert.equal(estimatePaceMinPerKm({ distanceKm: 10, durationMinutes: 57.5 }), 5.75);
});

test("buildRunPlan prefers an explicit duration over pace-derived duration", () => {
  const plan = buildRunPlan(
    {
      sex: "male",
      weightKg: 70,
      sweatRateLHr: 1.0,
      sweatSaltiness: "average",
      gutToleranceGHr: 90
    },
    {
      runType: "long",
      distanceKm: 22,
      paceMinPerKm: 5.75,
      durationMinutes: 150,
      temperatureC: 18,
      humidityPercent: 58,
      acclimatizationDays: 8
    },
    kitOf({ fuel: sisBetaFuel, quantity: 3 })
  );

  assert.equal(plan.durationMinutes, 150);
});

test("heat and wet-bulb approximations stay stable", () => {
  assert.equal(computeHeatIndexC(24, 30), 24);
  assertClose(computeHeatIndexC(32, 70), 40.4093, 0.001);
  assertClose(approximateWetBulbC(32, 70), 27.4587, 0.001);
  assertClose(approximateWBGTC(32, 70), 28.8211, 0.001);
});

test("short cool easy runs stay unfueled and do not require carried water", () => {
  const profile = {
    sex: "male",
    weightKg: 70,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    gutToleranceGHr: 90
  };

  const plan = buildRunPlan(
    profile,
    {
      runType: "easy",
      distanceKm: 5,
      paceMinPerKm: 5,
      temperatureC: 15,
      humidityPercent: 50,
      acclimatizationDays: 0
    },
    kitOf({ fuel: neversecondC30, quantity: 1 })
  );

  assert.equal(plan.durationMinutes, 25);
  assert.equal(plan.fuelingMode, "none");
  assert.equal(plan.totalWaterMl, 0);
  assert.equal(plan.hydrationPlan.mode, "optional");
  assert.equal(plan.fuelTimeline.events.length, 0);
  assert.equal(plan.totalExternalSodiumMg, 0);
  assert.equal(plan.warnings[0].tone, "success");
});

test("cool easy runs around an hour stay drink-to-thirst with optional carried electrolytes", () => {
  const profile = {
    sex: "male",
    weightKg: 70,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    gutToleranceGHr: 90
  };

  const plan = buildRunPlan(
    profile,
    {
      runType: "easy",
      distanceKm: 12,
      paceMinPerKm: 6,
      temperatureC: 15,
      humidityPercent: 50,
      acclimatizationDays: 0
    },
    kitOf({ fuel: neversecondC30, quantity: 1 })
  );

  assert.equal(plan.durationMinutes, 72);
  assert.equal(plan.hydrationPlan.mode, "thirst");
  assert.equal(plan.totalWaterMl, 400);
  assert.equal(plan.totalExternalSodiumMg, 540);
  assert.equal(plan.hydrationPlan.sodiumPer500MlFlask, 675);
  assert.equal(plan.hydrationPlan.flaskCountToCarry, 1);
});

test("tempo sessions under 75 minutes stay unfueled while hydration remains scheduled", () => {
  const profile = {
    sex: "male",
    weightKg: 70,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    gutToleranceGHr: 90
  };

  const plan = buildRunPlan(
    profile,
    {
      runType: "tempo",
      distanceKm: 12,
      paceMinPerKm: 5,
      temperatureC: 18,
      humidityPercent: 55,
      acclimatizationDays: 0
    },
    kitOf({ fuel: sisGoIsotonic, quantity: 1 })
  );

  assert.equal(plan.fuelingMode, "none");
  assert.equal(plan.totalCarbsGoal, 0);
  assert.equal(plan.requestedCarbsHr, 0);
  assert.equal(plan.fuelTimeline.actualServingsTotal, 0);
  assert.equal(plan.fuelTimeline.events.length, 0);
  assert.equal(plan.hydrationPlan.intervalMinutes, 20);
  assert.equal(plan.hydrationPlan.sipMl, 180);
  assert.equal(plan.totalExternalSodiumMg, 459);
  assert.equal(plan.hydrationPlan.sodiumPer500MlFlask, 425);
  assert.deepEqual(
    plan.hydrationPlan.events.map((event) => event.minute),
    [20, 40, 60]
  );
  assert.ok(
    plan.hydrationPlan.events.every((event) => event.pairedWithFuel === undefined)
  );
});

test("tempo sessions from 75 to 90 minutes use the supplied kit and align drinks to nearby fuel", () => {
  const profile = {
    sex: "male",
    weightKg: 70,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    gutToleranceGHr: 90
  };

  const plan = buildRunPlan(
    profile,
    {
      runType: "tempo",
      distanceKm: 16,
      paceMinPerKm: 5,
      temperatureC: 18,
      humidityPercent: 55,
      acclimatizationDays: 0
    },
    kitOf({ fuel: sisGoIsotonic, quantity: 2 })
  );

  assert.equal(plan.durationMinutes, 80);
  assert.equal(plan.fuelingMode, "fixed");
  assert.equal(plan.totalCarbsGoal, 30);
  assert.ok(plan.rationale.includes("Runs beyond an hour benefit from steady exogenous carbohydrate support."));
  assert.equal(plan.fuelTimeline.actualServingsTotal, 2);
  assert.equal(plan.fuelTimeline.actualCarbsTotal, 44);
  assert.deepEqual(
    plan.fuelTimeline.events.map((event) => event.minute),
    [25, 55]
  );
  assert.deepEqual(
    plan.hydrationPlan.events.map((event) => [event.minute, event.pairedWithFuel]),
    [
      [25, true],
      [40, false],
      [55, true],
      [80, false]
    ]
  );
  assert.equal(plan.totalExternalSodiumMg, 576);
  assert.equal(plan.hydrationPlan.sodiumPer500MlFlask, 400);
});

test("single-source running plans still auto-calculate full servings from one selected fuel", () => {
  const plan = buildRunPlan(
    {
      sex: "male",
      weightKg: 70,
      sweatRateLHr: 1.0,
      sweatSaltiness: "average",
      gutToleranceGHr: 90
    },
    {
      runType: "race",
      distanceKm: 21.1,
      paceMinPerKm: 4.5,
      temperatureC: 20,
      humidityPercent: 55,
      acclimatizationDays: 10
    },
    {
      mode: "single",
      selectedFuel: sisBetaFuel
    }
  );

  assert.equal(plan.fuelPlanMode, "single");
  assert.equal(plan.fuelTimeline.actualServingsTotal, 3);
  assert.equal(plan.fuelKitSummary.totalServings, 3);
  assert.equal(plan.fuelKitSummary.totalCarbs, 120);
  assert.equal(plan.scheduledFuelSodiumMg, 90);
  assert.deepEqual(
    plan.fuelTimeline.events.map((event) => event.minute),
    [25, 45, 70]
  );
});

test("hot long runs cap single-source carbs, increase sodium, and use a 15-minute drink rhythm", () => {
  const profile = {
    sex: "male",
    weightKg: 70,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    gutToleranceGHr: 90
  };

  const plan = buildRunPlan(
    profile,
    {
      runType: "long",
      distanceKm: 30,
      paceMinPerKm: 6,
      temperatureC: 32,
      humidityPercent: 70,
      acclimatizationDays: 2
    },
    kitOf({ fuel: sisGoIsotonic, quantity: 9 })
  );

  assert.equal(plan.heatCategory, "very-high");
  assert.equal(plan.requestedCarbsHr, 60);
  assert.equal(plan.targetSodiumMgHr, 900);
  assert.ok(plan.rationale.includes("Runs beyond an hour benefit from steady exogenous carbohydrate support."));
  assert.equal(plan.hydrationPlan.intervalMinutes, 15);
  assert.equal(plan.hydrationPlan.sipMl, 200);
  assert.equal(plan.totalWaterMl, 2400);
  assert.equal(plan.totalExternalSodiumMg, 2640);
  assert.equal(plan.hydrationPlan.sodiumPer500MlFlask, 550);
  assert.equal(plan.fuelTimeline.actualServingsTotal, 9);
  assert.equal(plan.fuelTimeline.actualCarbsHr, 66);
  assert.equal(plan.preStartFuel?.minute, -15);
  assert.ok(plan.preStartFuel?.label.includes("10 to 15 minutes before the start"));
  assert.ok(plan.preStartFuel?.warning.includes("15 to 30 minutes early"));
  assert.ok(plan.warnings.some((warning) => warning.text.includes("Heat stress is very high")));
  assert.ok(plan.warnings.some((warning) => warning.text.includes("early in heat exposure")));
});

test("race fueling keeps intra-run targets weight-independent while kit overshoot still warns", () => {
  const maleProfile = {
    sex: "male",
    weightKg: 70,
    sweatRateLHr: 1.0,
    sweatSaltiness: "average",
    gutToleranceGHr: 90
  };
  const femaleProfile = { ...maleProfile, sex: "female" };

  const malePlan = buildRunPlan(
    maleProfile,
    {
      runType: "race",
      distanceKm: 21.1,
      paceMinPerKm: 4.5,
      temperatureC: 20,
      humidityPercent: 55,
      acclimatizationDays: 10
    },
    kitOf({ fuel: sisBetaFuel, quantity: 3 })
  );
  const femalePlan = buildRunPlan(
    femaleProfile,
    {
      runType: "race",
      distanceKm: 21.1,
      paceMinPerKm: 4.5,
      temperatureC: 20,
      humidityPercent: 55,
      acclimatizationDays: 10
    },
    kitOf({ fuel: sisBetaFuel, quantity: 3 })
  );

  assert.equal(malePlan.requestedCarbsHr, 65);
  assert.equal(malePlan.fuelTimeline.actualServingsTotal, 3);
  assert.equal(malePlan.fuelTimeline.actualCarbsTotal, 120);
  assertClose(malePlan.fuelTimeline.actualCarbsHr, 75.8, 0.01);
  assert.equal(malePlan.preStartFuel?.minute, -15);
  assert.ok(malePlan.preStartFuel?.label.includes("10 to 15 minutes before the start"));
  assert.deepEqual(
    malePlan.fuelTimeline.events.map((event) => event.minute),
    [25, 45, 70]
  );
  assert.ok(malePlan.warnings.some((warning) => warning.text.includes("may increase GI risk")));
  assert.equal(malePlan.totalWaterMl, 1050);
  assert.ok(femalePlan.totalWaterMl < malePlan.totalWaterMl);
});

test("intra-run carbohydrate targets stay the same across body weights", () => {
  const lighterPlan = buildRunPlan(
    {
      sex: "male",
      weightKg: 55,
      sweatRateLHr: 1.0,
      sweatSaltiness: "average",
      gutToleranceGHr: 90
    },
    {
      runType: "race",
      distanceKm: 21.1,
      paceMinPerKm: 4.5,
      temperatureC: 20,
      humidityPercent: 55,
      acclimatizationDays: 10
    },
    kitOf({ fuel: sisBetaFuel, quantity: 3 })
  );
  const heavierPlan = buildRunPlan(
    {
      sex: "male",
      weightKg: 85,
      sweatRateLHr: 1.0,
      sweatSaltiness: "average",
      gutToleranceGHr: 90
    },
    {
      runType: "race",
      distanceKm: 21.1,
      paceMinPerKm: 4.5,
      temperatureC: 20,
      humidityPercent: 55,
      acclimatizationDays: 10
    },
    kitOf({ fuel: sisBetaFuel, quantity: 3 })
  );

  assert.equal(lighterPlan.requestedCarbsHr, heavierPlan.requestedCarbsHr);
  assert.equal(lighterPlan.fuelTimeline.actualCarbsTotal, heavierPlan.fuelTimeline.actualCarbsTotal);
  assert.deepEqual(
    lighterPlan.fuelTimeline.events.map((event) => event.minute),
    heavierPlan.fuelTimeline.events.map((event) => event.minute)
  );
});

test("sweat-rate math preserves fluid-loss, body-mass-loss, and replace-window outputs", () => {
  const sweat = calculateSweatRate({
    preMassKg: 70,
    postMassKg: 68.9,
    fluidLiters: 0.6,
    durationMinutes: 60
  });

  assert.equal(sweat.sweatRateLHr, 1.7);
  assert.equal(sweat.bodyMassLossPercent, 1.6);
  assert.equal(sweat.replaceWindowLHr, 1.27);
});

test("daily macro targets hold the current training-band thresholds and female RED-S messaging", () => {
  const halfHour = calculateDailyMacros({ sex: "male", weightKg: 60, trainingHours: 0.5 });
  const oneHour = calculateDailyMacros({ sex: "male", weightKg: 60, trainingHours: 1 });
  const twoHours = calculateDailyMacros({ sex: "male", weightKg: 60, trainingHours: 2 });
  const threeHours = calculateDailyMacros({ sex: "male", weightKg: 60, trainingHours: 3 });
  const fourHours = calculateDailyMacros({ sex: "female", weightKg: 60, trainingHours: 4, intakeKcal: 1800 });

  assert.deepEqual(halfHour.carbsRange, [180, 300]);
  assert.deepEqual(oneHour.carbsRange, [300, 420]);
  assert.deepEqual(twoHours.carbsRange, [360, 600]);
  assert.deepEqual(threeHours.carbsRange, [420, 600]);
  assert.deepEqual(fourHours.carbsRange, [480, 720]);
  assert.deepEqual(fourHours.proteinRange, [96, 120]);
  assert.deepEqual(fourHours.fatRange, [48, 72]);
  assert.deepEqual(fourHours.postRunCarbsPerHour, [60, 72]);
  assert.deepEqual(fourHours.postRunProtein, [15, 18]);
  assert.equal(fourHours.heuristicDailyNeed, 3480);
  assert.equal(fourHours.minimumMacroCalories, 2736);
  assert.ok(fourHours.redsRisk?.includes("RED-S risk flag"));
});

test("gut training progression preserves the current symptom-based adjustments", () => {
  const moderate = buildGutTrainingPlan({
    currentWeek: 5,
    goalCarbsHr: 90,
    currentToleranceGHr: 55,
    symptomSeverity: "moderate"
  });
  const severe = buildGutTrainingPlan({
    currentWeek: 1,
    goalCarbsHr: 90,
    currentToleranceGHr: 30,
    symptomSeverity: "severe"
  });
  const mild = buildGutTrainingPlan({
    currentWeek: 3,
    goalCarbsHr: 90,
    currentToleranceGHr: 50,
    symptomSeverity: "mild"
  });
  const none = buildGutTrainingPlan({
    currentWeek: 2,
    goalCarbsHr: 90,
    currentToleranceGHr: 30,
    symptomSeverity: "none"
  });

  assert.equal(moderate.peakTarget, 90);
  assert.deepEqual(moderate.plan[4], {
    week: 5,
    targetCarbsHr: 45,
    note: "Reduce the step-up slightly and repeat this dose if symptoms continue."
  });
  assert.deepEqual(severe.plan[0], {
    week: 1,
    targetCarbsHr: 30,
    note: "Hold this week at the previous level because recent GI symptoms were severe."
  });
  assert.deepEqual(mild.plan[2], {
    week: 3,
    targetCarbsHr: 50,
    note: "Progress is fine, but keep the fuel source and timing consistent."
  });
  assert.deepEqual(none.plan[1], {
    week: 2,
    targetCarbsHr: 40,
    note: "Progress as planned."
  });
});

test("HYROX plans keep the mid-race roxzone mapping and pre-race loading guidance", () => {
  const profile = {
    sex: "female",
    weightKg: 60,
    sweatRateLHr: 0.8,
    sweatSaltiness: "average"
  };
  const settings = {
    runPaceMinPerKm: 5,
    transitionSeconds: 42,
    stationEstimates: [
      { name: "SkiErg", minutes: 4.4 },
      { name: "Sled Push", minutes: 3.0 },
      { name: "Sled Pull", minutes: 2.9 },
      { name: "Burpee Broad Jumps", minutes: 4.8 },
      { name: "Row", minutes: 4.3 },
      { name: "Farmers Carry", minutes: 2.2 },
      { name: "Sandbag Lunges", minutes: 4.0 },
      { name: "Wall Balls", minutes: 4.5 }
    ]
  };

  const plan = buildHyroxPlan(profile, settings, kitOf({ fuel: neversecondC30, quantity: 2 }));

  assert.equal(plan.predictedDurationMinutes, 76);
  assert.equal(plan.targetCarbsHr, 30);
  assert.deepEqual(plan.carbLoadingRange, [420, 600]);
  assert.deepEqual(plan.raceMorningRange, [60, 240]);
  assert.equal(plan.actualCarbsTotal, 60);
  assert.equal(plan.actualCarbsHr, 47.4);
  assert.deepEqual(
    plan.fuelEvents.map((event) => [event.minute, event.roxzoneLabel]),
    [
      [-15, "Pre-start"],
      [38, "Roxzone after Burpee Broad Jumps"]
    ]
  );
  assert.ok(plan.fuelEvents[0].label.includes("Avoid taking it too early"));
  assert.equal(plan.hydrationPlan.intervalMinutes, 20);
  assert.equal(plan.hydrationPlan.totalWaterMl, 800);
  assert.equal(plan.hydrationPlan.totalExternalSodiumMg, 240);
  assert.deepEqual(
    plan.hydrationPlan.events.map((event) => [event.minute, event.roxzoneLabel]),
    [
      [19, "Roxzone after Sled Push"],
      [38, "Roxzone after Burpee Broad Jumps"],
      [56, "Roxzone after Farmers Carry"],
      [76, "Roxzone after Wall Balls"]
    ]
  );
  assert.equal(plan.breakdown[1].detail, "00:04:24 estimated station time");
  assert.ok(plan.dailyTargets[1].includes("420 to 600 g"));
  assert.ok(plan.timingProtocol[2].text.includes("500 mL electrolyte bottle"));
});

test("HYROX keeps the short-race and long-race fueling branches stable", () => {
  const shortPlan = buildHyroxPlan(
    {
      sex: "male",
      weightKg: 75,
      sweatRateLHr: 0.9,
      sweatSaltiness: "average"
    },
    {
      runPaceMinPerKm: 4.5,
      transitionSeconds: 40,
      stationEstimates: [
        { name: "SkiErg", minutes: 3.8 },
        { name: "Sled Push", minutes: 3.0 },
        { name: "Sled Pull", minutes: 3.0 },
        { name: "Burpee Broad Jumps", minutes: 4.2 },
        { name: "Row", minutes: 3.7 },
        { name: "Farmers Carry", minutes: 2.0 },
        { name: "Sandbag Lunges", minutes: 3.8 },
        { name: "Wall Balls", minutes: 4.2 }
      ]
    },
    kitOf({ fuel: neversecondC30, quantity: 1 })
  );

  const longPlan = buildHyroxPlan(
    {
      sex: "male",
      weightKg: 80,
      sweatRateLHr: 1.3,
      sweatSaltiness: "salty"
    },
    {
      runPaceMinPerKm: 6.5,
      transitionSeconds: 45,
      stationEstimates: [
        { name: "SkiErg", minutes: 5.8 },
        { name: "Sled Push", minutes: 4.5 },
        { name: "Sled Pull", minutes: 4.5 },
        { name: "Burpee Broad Jumps", minutes: 6.0 },
        { name: "Row", minutes: 5.2 },
        { name: "Farmers Carry", minutes: 3.0 },
        { name: "Sandbag Lunges", minutes: 5.6 },
        { name: "Wall Balls", minutes: 7.0 }
      ]
    },
    kitOf({ fuel: sisBetaFuel, quantity: 3 })
  );

  assert.equal(shortPlan.predictedDurationMinutes, 69);
  assert.equal(shortPlan.targetCarbsHr, 0);
  assert.equal(shortPlan.fuelEvents.length, 1);
  assert.ok(shortPlan.fuelEvents[0].label.includes("caffeine gel"));
  assert.ok(shortPlan.fuelEvents[0].label.includes("avoid taking it too early"));

  assert.equal(longPlan.predictedDurationMinutes, 100);
  assert.equal(longPlan.targetCarbsHr, 45);
  assert.deepEqual(
    longPlan.fuelEvents.map((event) => [event.minute, event.roxzoneLabel]),
    [
      [-15, "Pre-start"],
      [50, "Roxzone after Burpee Broad Jumps"],
      [73, "Roxzone after Farmers Carry"]
    ]
  );
  assert.equal(longPlan.hydrationPlan.intervalMinutes, 15);
  assert.equal(longPlan.hydrationPlan.totalWaterMl, 1400);
  assert.equal(longPlan.hydrationPlan.totalExternalSodiumMg, 1330);
  assert.ok(longPlan.warnings.some((warning) => warning.text.includes("mid-race fueling becomes much more important")));
});

test("single-source HYROX plans still auto-place pre-start and mid-race servings", () => {
  const plan = buildHyroxPlan(
    {
      sex: "male",
      weightKg: 80,
      sweatRateLHr: 1.3,
      sweatSaltiness: "salty"
    },
    {
      runPaceMinPerKm: 6.5,
      transitionSeconds: 45,
      stationEstimates: [
        { name: "SkiErg", minutes: 5.8 },
        { name: "Sled Push", minutes: 4.5 },
        { name: "Sled Pull", minutes: 4.5 },
        { name: "Burpee Broad Jumps", minutes: 6.0 },
        { name: "Row", minutes: 5.2 },
        { name: "Farmers Carry", minutes: 3.0 },
        { name: "Sandbag Lunges", minutes: 5.6 },
        { name: "Wall Balls", minutes: 7.0 }
      ]
    },
    {
      mode: "single",
      selectedFuel: sisBetaFuel
    }
  );

  assert.equal(plan.fuelPlanMode, "single");
  assert.equal(plan.fuelKitSummary.totalServings, 3);
  assert.equal(plan.actualCarbsTotal, 120);
  assert.deepEqual(
    plan.fuelEvents.map((event) => [event.minute, event.roxzoneLabel]),
    [
      [-15, "Pre-start"],
      [50, "Roxzone after Burpee Broad Jumps"],
      [73, "Roxzone after Farmers Carry"]
    ]
  );
});

test("mixed hydrogel kits stay separated in the timeline and trigger a stomach-safety warning", () => {
  const plan = buildRunPlan(
    {
      sex: "female",
      weightKg: 62,
      sweatRateLHr: 0.9,
      sweatSaltiness: "average",
      gutToleranceGHr: 90
    },
    {
      runType: "long",
      distanceKm: 28,
      paceMinPerKm: 6,
      temperatureC: 18,
      humidityPercent: 55,
      acclimatizationDays: 6
    },
    kitOf(
      { fuel: sisBetaFuel, quantity: 2, addedOrder: 1 },
      { fuel: maurtenGel100, quantity: 2, addedOrder: 2 }
    )
  );

  assert.equal(plan.fuelKitSummary.hasMixedHydrogelKit, true);
  assert.deepEqual(
    plan.fuelTimeline.events.map((event) => event.fuelType),
    ["standard-gel", "standard-gel", "hydrogel", "hydrogel"]
  );
  assert.ok(plan.fuelTimeline.events[2].minute - plan.fuelTimeline.events[1].minute >= 20);
  assert.ok(
    plan.warnings.some((warning) =>
      warning.text.includes("mixes hydrogels with standard sugars or solids")
    )
  );
});
