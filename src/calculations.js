const SODIUM_BY_SWEATER = {
  low: 300,
  average: 450,
  salty: 800
};

const RUN_TYPE_TARGETS = {
  easy: { low: 30, medium: 40, high: 60 },
  recovery: { low: 30, medium: 35, high: 55 },
  tempo: { low: 45, medium: 55, high: 75 },
  interval: { low: 45, medium: 55, high: 70 },
  long: { low: 45, medium: 55, high: 75 },
  race: { low: 55, medium: 65, high: 90 }
};

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundToNearest(value, step = 5) {
  return Math.round(value / step) * step;
}

export function formatClock(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs === 0) {
    return `${mins} min`;
  }
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

export function estimateDurationMinutes({ distanceKm, paceMinPerKm }) {
  if (!distanceKm || !paceMinPerKm) {
    return 0;
  }
  return distanceKm * paceMinPerKm;
}

function celsiusToFahrenheit(value) {
  return value * (9 / 5) + 32;
}

function fahrenheitToCelsius(value) {
  return (value - 32) * (5 / 9);
}

export function computeHeatIndexC(temperatureC, humidityPercent) {
  const temperatureF = celsiusToFahrenheit(temperatureC);
  if (temperatureF < 80 || humidityPercent < 40) {
    return temperatureC;
  }

  const t = temperatureF;
  const r = humidityPercent;
  const heatIndexF =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r;

  return fahrenheitToCelsius(heatIndexF);
}

export function approximateWetBulbC(temperatureC, humidityPercent) {
  const rh = humidityPercent;
  return (
    temperatureC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(temperatureC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035
  );
}

export function approximateWBGTC(temperatureC, humidityPercent) {
  const wetBulbC = approximateWetBulbC(temperatureC, humidityPercent);
  return 0.7 * wetBulbC + 0.3 * temperatureC;
}

function getHeatCategory(heatIndexC) {
  if (heatIndexC > 40.5) {
    return "danger";
  }
  if (heatIndexC > 35) {
    return "very-high";
  }
  if (heatIndexC > 29.5) {
    return "high";
  }
  return "normal";
}

function getGuidelineFluidTargetLHr(profile, run, heatIndexC, heatCategory, durationMinutes) {
  const warmCondition = heatIndexC > 26.6;
  const veryHotCondition = ["very-high", "danger"].includes(heatCategory);
  const highHeatCondition = ["high", "very-high", "danger"].includes(heatCategory);
  const femaleAdjustment = profile.sex === "female" ? 0.92 : 1;
  const easyOrRecovery = ["easy", "recovery"].includes(run.runType);
  const qualitySession = ["tempo", "interval"].includes(run.runType) && durationMinutes <= 90;

  if (easyOrRecovery) {
    if (durationMinutes < 45 && !warmCondition) {
      return 0;
    }

    if (durationMinutes < 90 && !warmCondition) {
      return clamp(profile.sweatRateLHr * 0.35 * femaleAdjustment, 0.25, 0.55);
    }

    const replacementFactor = veryHotCondition ? 0.65 : warmCondition ? 0.55 : 0.45;
    const minimumLHr = durationMinutes >= 60 || highHeatCondition ? 0.3 : 0.2;
    const maximumLHr = veryHotCondition ? 0.8 : warmCondition ? 0.65 : 0.55;
    return clamp(profile.sweatRateLHr * replacementFactor * femaleAdjustment, minimumLHr, maximumLHr);
  }

  if (qualitySession) {
    const replacementFactor = veryHotCondition ? 0.82 : warmCondition ? 0.72 : 0.58;
    const minimumLHr = warmCondition ? 0.4 : 0.3;
    const maximumLHr = veryHotCondition ? 0.9 : warmCondition ? 0.8 : 0.75;
    return clamp(profile.sweatRateLHr * replacementFactor * femaleAdjustment, minimumLHr, maximumLHr);
  }

  const replacementFactor = veryHotCondition ? 0.88 : warmCondition ? 0.78 : 0.65;
  const minimumLHr = warmCondition ? 0.5 : 0.4;
  const maximumLHr = veryHotCondition ? 1.0 : warmCondition ? 0.9 : 0.8;
  return clamp(profile.sweatRateLHr * replacementFactor * femaleAdjustment, minimumLHr, maximumLHr);
}

function pickBaseCarbTarget(runType, durationMinutes) {
  if (["easy", "recovery"].includes(runType) && durationMinutes < 75) {
    return {
      mode: "none",
      targetCarbsHr: 0,
      totalCarbs: 0,
      rationale: "Short easy or recovery running can stay unfueled so the session stays aerobic and simple."
    };
  }

  if (["tempo", "interval"].includes(runType) && durationMinutes < 90) {
    return {
      mode: "fixed",
      targetCarbsHr: 0,
      totalCarbs: 30,
      rationale: "Sub-90-minute quality work gets one focused carbohydrate hit to protect late-session quality and train the gut."
    };
  }

  const band =
    durationMinutes > 150 ? "high" : durationMinutes >= 60 && durationMinutes <= 150 ? "medium" : "low";
  const targetCarbsHr = RUN_TYPE_TARGETS[runType][band];

  return {
    mode: "hourly",
    targetCarbsHr,
    totalCarbs: 0,
    rationale:
      band === "high"
        ? "Extended endurance running pushes carbohydrate demand into the 60 to 90 grams per hour zone."
        : "Runs beyond an hour benefit from steady exogenous carbohydrate support."
  };
}

function clampFuelByTransport(targetCarbsHr, fuel, gutToleranceGHr) {
  const transportCap = fuel.transportType === "dual" ? 100 : 60;
  return clamp(targetCarbsHr, 0, Math.min(gutToleranceGHr, transportCap));
}

function buildFuelTimes(durationMinutes, servingCount) {
  if (servingCount <= 0) {
    return [];
  }

  const times = [];
  for (let index = 0; index < servingCount; index += 1) {
    const rawMinute = (durationMinutes * (index + 1)) / (servingCount + 1);
    const roundedMinute = clamp(roundToNearest(rawMinute, 5), 15, Math.max(durationMinutes - 5, 15));
    const previous = times.at(-1);
    const safeMinute = previous && roundedMinute <= previous ? previous + 5 : roundedMinute;
    times.push(Math.min(safeMinute, Math.max(durationMinutes - 5, 15)));
  }
  return times;
}

function makeFuelTimeline({ durationMinutes, targetCarbsHr, totalCarbs, mode, fuel }) {
  if (mode === "none" || (targetCarbsHr === 0 && totalCarbs === 0)) {
    return {
      events: [],
      actualCarbsTotal: 0,
      actualCarbsHr: 0,
      actualServingsTotal: 0
    };
  }

  const durationHours = durationMinutes / 60;
  const desiredCarbsTotal = mode === "fixed" ? totalCarbs : targetCarbsHr * durationHours;
  const servingsTotal = Math.max(1, Math.ceil(desiredCarbsTotal / fuel.carbsPerServing));
  const times = buildFuelTimes(durationMinutes, servingsTotal);
  const events = times.map((minute) => ({
    minute,
    servings: 1,
    carbs: fuel.carbsPerServing,
    label: `1 full ${fuel.name}`
  }));
  const actualCarbsTotal = servingsTotal * fuel.carbsPerServing;

  return {
    events,
    actualCarbsTotal: round(actualCarbsTotal, 1),
    actualCarbsHr: round(actualCarbsTotal / durationHours, 1),
    actualServingsTotal: servingsTotal
  };
}

function alignHydrationWithFuelEvents(hydrationPlan, fuelTimeline, windowMinutes = 10) {
  if (!hydrationPlan.events.length || !fuelTimeline.events.length) {
    return hydrationPlan;
  }

  const reservedFuelMinutes = new Set();
  const alignedEvents = hydrationPlan.events.map((event) => {
    const nearestFuelEvent = fuelTimeline.events
      .map((fuelEvent) => ({
        fuelEvent,
        difference: Math.abs(fuelEvent.minute - event.minute)
      }))
      .filter(({ difference, fuelEvent }) => difference <= windowMinutes && !reservedFuelMinutes.has(fuelEvent.minute))
      .sort((left, right) => left.difference - right.difference)[0];

    if (!nearestFuelEvent) {
      return {
        ...event,
        pairedWithFuel: false
      };
    }

    reservedFuelMinutes.add(nearestFuelEvent.fuelEvent.minute);
    return {
      ...event,
      minute: nearestFuelEvent.fuelEvent.minute,
      pairedWithFuel: true
    };
  });

  return {
    ...hydrationPlan,
    events: alignedEvents
  };
}

function makeHydrationPlan({ runType, durationMinutes, targetFluidLHr, totalExternalSodiumMg, heatCategory, heatIndexC }) {
  const flaskVolumeMl = 500;
  const durationHours = durationMinutes / 60;
  const easyOrRecovery = ["easy", "recovery"].includes(runType);
  const qualitySession = ["tempo", "interval"].includes(runType) && durationMinutes < 90;
  const warmCondition = heatIndexC > 26.6;
  const shortEasyCool = easyOrRecovery && durationMinutes < 45 && !warmCondition;
  const drinkToThirst = easyOrRecovery && durationMinutes < 90 && !warmCondition;

  if (shortEasyCool) {
    return {
      mode: "optional",
      guidance:
        "No strict hydration schedule is needed here. If you started well hydrated, carrying water is often unnecessary for a short easy or recovery run in cool conditions.",
      intervalMinutes: 0,
      totalWaterMl: 0,
      totalExternalSodiumMg: 0,
      sipMl: 0,
      sipFlaskFraction: 0,
      flaskVolumeMl,
      flaskCountEquivalent: 0,
      flaskCountToCarry: 0,
      sodiumPer500MlFlask: 0,
      events: []
    };
  }

  if (drinkToThirst && !qualitySession) {
    const optionalCarryMl = durationMinutes >= 60 ? clamp(roundToNearest(targetFluidLHr * durationHours * 1000, 50), 250, 600) : 0;
    const sodiumPer500MlFlask =
      optionalCarryMl > 0 ? roundToNearest((totalExternalSodiumMg / optionalCarryMl) * flaskVolumeMl, 25) : 0;
    const plannedExternalSodiumMg = optionalCarryMl > 0 ? round((sodiumPer500MlFlask / flaskVolumeMl) * optionalCarryMl, 0) : 0;

    return {
      mode: "thirst",
      guidance:
        "Drink to thirst rather than following a strict timer. On cooler easy and recovery runs, that is usually enough. If you choose to carry water, use it flexibly instead of forcing frequent sips.",
      intervalMinutes: 0,
      totalWaterMl: optionalCarryMl,
      totalExternalSodiumMg: plannedExternalSodiumMg,
      sipMl: 0,
      sipFlaskFraction: 0,
      flaskVolumeMl,
      flaskCountEquivalent: round(optionalCarryMl / flaskVolumeMl, 2),
      flaskCountToCarry: optionalCarryMl > 0 ? Math.ceil(optionalCarryMl / flaskVolumeMl) : 0,
      sodiumPer500MlFlask,
      events: []
    };
  }

  let intervalMinutes = 20;
  let minDrinkMl = 120;
  let maxDrinkMl = 180;
  let guidance =
    "Take larger drinks on a practical rhythm instead of constant sipping so the fluid moves through the stomach more efficiently.";

  if (qualitySession) {
    guidance =
      "Plan drinks every 20 minutes. A larger 120 to 180 mL drink is more practical than constant sipping, and interval sessions are easiest if you drink during recovery jogs or walking recoveries.";
  } else {
    intervalMinutes = targetFluidLHr > 0.6 || warmCondition || ["high", "very-high", "danger"].includes(heatCategory) ? 15 : 20;
    minDrinkMl = 100;
    maxDrinkMl = 200;
    guidance =
      intervalMinutes === 15
        ? "Use a structured 15-minute drinking rhythm on this long effort. That keeps each drink in the practical 100 to 200 mL range while supporting higher hourly fluid needs."
        : "Use a structured 20-minute drinking rhythm on this long effort. That lines up well with aid-station style access and avoids constant sipping.";
  }

  const eventCount = Math.max(1, Math.ceil(durationMinutes / intervalMinutes));
  const rawTotalWaterMl = round(targetFluidLHr * durationHours * 1000, 0);
  const sipMl = clamp(roundToNearest(rawTotalWaterMl / eventCount, 10), minDrinkMl, maxDrinkMl);
  const totalWaterMl = sipMl * eventCount;
  const sipFlaskFraction = round(sipMl / flaskVolumeMl, 2);
  const flaskCountEquivalent = round(totalWaterMl / flaskVolumeMl, 2);
  const flaskCountToCarry = Math.max(1, Math.ceil(totalWaterMl / flaskVolumeMl));
  const sodiumPer500MlFlask =
    totalWaterMl > 0 ? roundToNearest((totalExternalSodiumMg / totalWaterMl) * flaskVolumeMl, 25) : 0;
  const plannedExternalSodiumMg = round((sodiumPer500MlFlask / flaskVolumeMl) * totalWaterMl, 0);
  const events = [];

  for (let index = 1; index <= eventCount; index += 1) {
    const minute = Math.min(index * intervalMinutes, durationMinutes);
    events.push({
      minute,
      sipMl,
      sipFlaskFraction
    });
  }

  return {
    mode: "scheduled",
    guidance,
    intervalMinutes,
    totalWaterMl,
    totalExternalSodiumMg: plannedExternalSodiumMg,
    sipMl,
    sipFlaskFraction,
    flaskVolumeMl,
    flaskCountEquivalent,
    flaskCountToCarry,
    sodiumPer500MlFlask,
    events
  };
}

function buildWarnings({
  heatIndexC,
  bodyMassLossPercent,
  targetCarbsHr,
  actualCarbsHr,
  fuel,
  acclimatizationDays,
  targetFluidLHr
}) {
  const warnings = [];

  if (heatIndexC > 40.5) {
    warnings.push({
      tone: "danger",
      text: "Heat index is above 40.5°C. Outside running carries serious heat-illness risk. Move indoors or reschedule."
    });
  } else if (heatIndexC > 35) {
    warnings.push({
      tone: "danger",
      text: "Heat stress is very high. Back pace off and be stricter with fluids and sodium."
    });
  } else if (heatIndexC > 29.5) {
    warnings.push({
      tone: "warn",
      text: "Heat index is above 29.5°C. Raise sodium intake and expect cardiovascular drift at normal paces."
    });
  } else {
    warnings.push({
      tone: "success",
      text: "Environmental strain is moderate. Standard hydration and sodium replacement should be sufficient."
    });
  }

  if (bodyMassLossPercent >= 2) {
    warnings.push({
      tone: "danger",
      text: `Projected body-water loss is ${round(bodyMassLossPercent, 1)}% of body mass, which is beyond the usual performance impairment threshold.`
    });
  }

  if (targetCarbsHr > 60 && fuel.transportType !== "dual") {
    warnings.push({
      tone: "warn",
      text: `${fuel.name} is not a dual-transport product. The app capped practical intake at 60 g/hr to protect the gut.`
    });
  }

  if (targetCarbsHr > 0 && actualCarbsHr > targetCarbsHr + 10) {
    warnings.push({
      tone: "warn",
      text: "Whole-gel scheduling overshoots the target a bit with this product. A denser gel may match the physiology more closely."
    });
  }

  if (heatIndexC > 29.5 && acclimatizationDays < 5) {
    warnings.push({
      tone: "warn",
      text: "You appear to be early in heat exposure. Sweat sodium losses are usually higher in the first 3 to 5 days, so keep electrolytes deliberate."
    });
  }

  if (targetFluidLHr > 1.1) {
    warnings.push({
      tone: "warn",
      text: "Hourly fluid demand is high enough that bottle volume and refill access will matter."
    });
  }

  return warnings;
}

export function buildRunPlan(profile, run, fuel) {
  const durationMinutes = estimateDurationMinutes(run);
  const durationHours = durationMinutes / 60;
  const heatIndexC = computeHeatIndexC(run.temperatureC, run.humidityPercent);
  const wbgtC = approximateWBGTC(run.temperatureC, run.humidityPercent);
  const heatCategory = getHeatCategory(heatIndexC);

  const baseFueling = pickBaseCarbTarget(run.runType, durationMinutes);
  const requestedCarbsHr =
    baseFueling.mode === "hourly" ? clampFuelByTransport(baseFueling.targetCarbsHr, fuel, profile.gutToleranceGHr) : 0;
  const totalCarbsGoal =
    baseFueling.mode === "fixed" ? baseFueling.totalCarbs : round(requestedCarbsHr * durationHours, 1);
  const fuelTimeline = makeFuelTimeline({
    durationMinutes,
    targetCarbsHr: requestedCarbsHr,
    totalCarbs: totalCarbsGoal,
    mode: baseFueling.mode,
    fuel
  });

  const sodiumBase = SODIUM_BY_SWEATER[profile.sweatSaltiness] ?? SODIUM_BY_SWEATER.average;
  const heatSodiumModifier = heatCategory === "danger" || heatCategory === "very-high" ? 350 : heatCategory === "high" ? 200 : 0;
  const acclimatizationModifier = run.acclimatizationDays < 5 && heatIndexC > 29.5 ? 100 : 0;
  const targetSodiumMgHr = sodiumBase + heatSodiumModifier + acclimatizationModifier;

  const targetFluidLHr = getGuidelineFluidTargetLHr(profile, run, heatIndexC, heatCategory, durationMinutes);

  const fuelSodiumMgHr = durationHours > 0 ? round((fuelTimeline.actualServingsTotal * fuel.sodiumPerServing) / durationHours, 0) : 0;
  const externalSodiumMgHr = Math.max(round(targetSodiumMgHr - fuelSodiumMgHr, 0), 0);
  const rawTotalExternalSodiumMg = round(externalSodiumMgHr * durationHours, 0);
  const hydrationPlan = makeHydrationPlan({
    runType: run.runType,
    durationMinutes,
    targetFluidLHr,
    totalExternalSodiumMg: rawTotalExternalSodiumMg,
    heatCategory,
    heatIndexC
  });
  const alignedHydrationPlan = alignHydrationWithFuelEvents(hydrationPlan, fuelTimeline);
  const plannedExternalSodiumMgHr =
    durationHours > 0 ? round(alignedHydrationPlan.totalExternalSodiumMg / durationHours, 0) : 0;

  const projectedNetFluidLossL = Math.max(profile.sweatRateLHr - targetFluidLHr, 0) * durationHours;
  const bodyMassLossPercent = (projectedNetFluidLossL / profile.weightKg) * 100;
  const distanceKm = run.distanceKm;
  const estimatedCalories = round(profile.weightKg * distanceKm, 0);

  const warnings = buildWarnings({
    heatIndexC,
    bodyMassLossPercent,
    targetCarbsHr: requestedCarbsHr,
    actualCarbsHr: fuelTimeline.actualCarbsHr,
    fuel,
    acclimatizationDays: run.acclimatizationDays,
    targetFluidLHr
  });

  return {
    durationMinutes: round(durationMinutes, 0),
    durationHours,
    distanceKm: round(distanceKm, 1),
    heatIndexC: round(heatIndexC, 1),
    wbgtC: round(wbgtC, 1),
    heatCategory,
    fuelingMode: baseFueling.mode,
    rationale: baseFueling.rationale,
    requestedCarbsHr,
    totalCarbsGoal,
    targetSodiumMgHr,
    targetFluidLHr: round(targetFluidLHr, 2),
    fuelSodiumMgHr,
    externalSodiumMgHr: plannedExternalSodiumMgHr,
    totalExternalSodiumMg: alignedHydrationPlan.totalExternalSodiumMg,
    totalFluidL: round(alignedHydrationPlan.totalWaterMl / 1000, 2),
    totalWaterMl: alignedHydrationPlan.totalWaterMl,
    fuelTimeline,
    hydrationPlan: alignedHydrationPlan,
    warnings,
    bodyMassLossPercent: round(bodyMassLossPercent, 1),
    estimatedCalories
  };
}

export function calculateSweatRate({ preMassKg, postMassKg, fluidLiters, durationMinutes }) {
  const lossKg = preMassKg - postMassKg;
  const sweatLiters = lossKg + fluidLiters;
  const sweatRateLHr = sweatLiters / (durationMinutes / 60);
  const bodyMassLossPercent = (lossKg / preMassKg) * 100;
  const replaceWindowLHr = clamp(sweatRateLHr * 0.75, 0.4, 1.3);

  return {
    sweatRateLHr: round(sweatRateLHr, 2),
    bodyMassLossPercent: round(bodyMassLossPercent, 1),
    replaceWindowLHr: round(replaceWindowLHr, 2)
  };
}

export function calculateDailyMacros({ sex, weightKg, trainingHours, intakeKcal }) {
  let carbRangeGKg = [3, 5];

  if (trainingHours >= 4) {
    carbRangeGKg = [8, 12];
  } else if (trainingHours >= 3) {
    carbRangeGKg = [7, 10];
  } else if (trainingHours >= 1.5) {
    carbRangeGKg = [6, 10];
  } else if (trainingHours >= 1) {
    carbRangeGKg = [5, 7];
  }

  const proteinRangeGKg = [1.6, 2.0];
  const fatRangeGKg = [0.8, 1.2];

  const carbsRange = carbRangeGKg.map((value) => round(value * weightKg, 0));
  const proteinRange = proteinRangeGKg.map((value) => round(value * weightKg, 0));
  const fatRange = fatRangeGKg.map((value) => round(value * weightKg, 0));
  const postRunCarbsPerHour = [round(weightKg * 1.0, 0), round(weightKg * 1.2, 0)];
  const postRunProtein = [round(weightKg * 0.25, 1), round(weightKg * 0.3, 1)];

  const minimumMacroCalories =
    carbsRange[0] * 4 + proteinRange[0] * 4 + fatRange[0] * 9;
  const estimatedExerciseKcal = round(trainingHours * weightKg * 7, 0);
  const heuristicDailyNeed = round(weightKg * 30 + estimatedExerciseKcal, 0);

  let redsRisk = null;
  if (sex === "female" && intakeKcal) {
    if (intakeKcal < heuristicDailyNeed * 0.85) {
      redsRisk =
        "Heuristic RED-S risk flag: logged intake sits meaningfully below a rough training-day energy need estimate. Consider closing the gap, especially with carbohydrates.";
    } else if (intakeKcal < heuristicDailyNeed) {
      redsRisk =
        "Energy intake looks borderline for the training load. Keep an eye on recovery quality, menstrual health, and repeated low-energy days.";
    }
  }

  return {
    carbsRange,
    proteinRange,
    fatRange,
    postRunCarbsPerHour,
    postRunProtein,
    heuristicDailyNeed,
    minimumMacroCalories,
    redsRisk
  };
}

export function buildGutTrainingPlan({ currentWeek, goalCarbsHr, currentToleranceGHr, symptomSeverity }) {
  const cappedGoal = clamp(goalCarbsHr, 30, 100);
  const anchors = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, cappedGoal - 5, cappedGoal];
  const plan = anchors.map((target, index) => {
    const week = index + 1;
    const baseTarget = clamp(round(target, 0), 30, cappedGoal);
    let adjustedTarget = baseTarget;
    let note = "Progress as planned.";

    if (week === currentWeek) {
      if (symptomSeverity === "severe") {
        adjustedTarget = index === 0 ? 30 : anchors[index - 1];
        note = "Hold this week at the previous level because recent GI symptoms were severe.";
      } else if (symptomSeverity === "moderate") {
        adjustedTarget = Math.max(30, baseTarget - 10);
        note = "Reduce the step-up slightly and repeat this dose if symptoms continue.";
      } else if (symptomSeverity === "mild") {
        adjustedTarget = Math.max(currentToleranceGHr, baseTarget);
        note = "Progress is fine, but keep the fuel source and timing consistent.";
      } else {
        adjustedTarget = Math.max(currentToleranceGHr, baseTarget);
      }
    }

    return {
      week,
      targetCarbsHr: round(adjustedTarget, 0),
      note
    };
  });

  return {
    plan,
    peakTarget: round(cappedGoal, 0)
  };
}
