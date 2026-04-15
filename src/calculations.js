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
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function estimateDurationMinutes({ distanceKm, paceMinPerKm }) {
  if (!distanceKm || !paceMinPerKm) {
    return 0;
  }
  return distanceKm * paceMinPerKm;
}

export function estimatePaceMinPerKm({ distanceKm, durationMinutes }) {
  if (!distanceKm || !durationMinutes) {
    return 0;
  }
  return durationMinutes / distanceKm;
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
  if (durationMinutes < 75) {
    return {
      mode: "none",
      targetCarbsHr: 0,
      totalCarbs: 0,
      rationale:
        "Runs under 75 minutes can rely on endogenous glycogen, so intra-run carbohydrates are usually unnecessary."
    };
  }

  if (["tempo", "interval"].includes(runType) && durationMinutes < 90) {
    return {
      mode: "fixed",
      targetCarbsHr: 0,
      totalCarbs: 30,
      rationale:
        "Sub-90-minute quality work gets one focused carbohydrate hit to protect late-session quality and train the gut. Runs beyond an hour benefit from steady exogenous carbohydrate support."
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
        ? "Extended endurance running pushes carbohydrate demand into the 60 to 90 grams per hour zone. Runs beyond an hour benefit from steady exogenous carbohydrate support."
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
    actualServingsTotal: servingsTotal,
    totalSodium: round(servingsTotal * fuel.sodiumPerServing, 0),
    timelineWarning: null
  };
}

function getPreStartFuelRecommendation(runType, durationMinutes, fuelingKit) {
  if (!["long", "race"].includes(runType) || durationMinutes < 75) {
    return null;
  }

  const preStartItem = selectPreStartFuelItem(fuelingKit);
  if (!preStartItem) {
    return null;
  }

  return {
    minute: -15,
    label: `Take 1 serving of ${preStartItem.name} 10 to 15 minutes before the start with a few sips of water.`,
    warning:
      "Do not take it too early while you are still standing around. More than 15 to 30 minutes early can trigger an insulin spike and leave you flat on the start line."
  };
}

const TIMELINE_TYPE_PRIORITY = {
  solid: 0,
  "standard-gel": 1,
  drink: 1,
  hydrogel: 2
};

const PRESTART_TYPE_PRIORITY = {
  "standard-gel": 0,
  hydrogel: 1,
  drink: 1,
  solid: 2
};

function normalizeFuelingKit(fuelingKit) {
  if (!Array.isArray(fuelingKit)) {
    return [];
  }

  return fuelingKit
    .filter((item) => item && Number(item.quantity) > 0)
    .map((item, index) => ({
      ...item,
      quantity: Math.max(1, Math.round(Number(item.quantity))),
      fuelType: item.fuelType ?? "standard-gel",
      transportType: item.transportType ?? "single",
      addedOrder: Number(item.addedOrder ?? index)
    }));
}

function expandFuelingKit(fuelingKit) {
  return normalizeFuelingKit(fuelingKit).flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      ...item,
      unitIndex: index
    }))
  );
}

function summarizeFuelingKit(fuelingKit) {
  const normalizedKit = normalizeFuelingKit(fuelingKit);
  const totalCarbs = normalizedKit.reduce((sum, item) => sum + item.carbsPerServing * item.quantity, 0);
  const totalSodium = normalizedKit.reduce((sum, item) => sum + item.sodiumPerServing * item.quantity, 0);
  const totalCalories = normalizedKit.reduce((sum, item) => sum + (item.calories ?? 0) * item.quantity, 0);
  const totalServings = normalizedKit.reduce((sum, item) => sum + item.quantity, 0);
  const hasDualTransport = normalizedKit.some((item) => item.transportType === "dual");
  const hasHydrogel = normalizedKit.some((item) => item.fuelType === "hydrogel");
  const hasStandardSugar = normalizedKit.some((item) => item.fuelType !== "hydrogel");
  const uniqueNotes = [...new Set(normalizedKit.map((item) => item.notes).filter(Boolean))];
  const uniqueNames = [...new Set(normalizedKit.map((item) => item.name))];

  return {
    items: normalizedKit,
    totalCarbs: round(totalCarbs, 1),
    totalSodium: round(totalSodium, 0),
    totalCalories: round(totalCalories, 0),
    totalServings,
    hasDualTransport,
    hasHydrogel,
    hasStandardSugar,
    hasMixedHydrogelKit: hasHydrogel && hasStandardSugar,
    uniqueNotes,
    uniqueNames
  };
}

function normalizeFuelPlanInput(fuelingInput) {
  if (Array.isArray(fuelingInput)) {
    return {
      mode: "multiple",
      fuelingKit: fuelingInput,
      selectedFuel: null
    };
  }

  if (fuelingInput && Array.isArray(fuelingInput.fuelingKit)) {
    return {
      mode: fuelingInput.mode === "single" ? "single" : "multiple",
      fuelingKit: fuelingInput.fuelingKit,
      selectedFuel: fuelingInput.selectedFuel ?? null
    };
  }

  if (fuelingInput && fuelingInput.mode === "single" && fuelingInput.selectedFuel) {
    return {
      mode: "single",
      fuelingKit: [],
      selectedFuel: fuelingInput.selectedFuel
    };
  }

  if (fuelingInput && typeof fuelingInput === "object" && "carbsPerServing" in fuelingInput) {
    return {
      mode: "single",
      fuelingKit: [],
      selectedFuel: fuelingInput
    };
  }

  return {
    mode: "multiple",
    fuelingKit: [],
    selectedFuel: null
  };
}

function summarizeSingleFuelPlan(selectedFuel, actualServingsTotal) {
  if (!selectedFuel || actualServingsTotal <= 0) {
    return {
      items: selectedFuel ? [{ ...selectedFuel, quantity: 0 }] : [],
      totalCarbs: 0,
      totalSodium: 0,
      totalCalories: 0,
      totalServings: 0,
      hasDualTransport: selectedFuel?.transportType === "dual",
      hasHydrogel: selectedFuel?.fuelType === "hydrogel",
      hasStandardSugar: selectedFuel ? selectedFuel.fuelType !== "hydrogel" : false,
      hasMixedHydrogelKit: false,
      uniqueNotes: selectedFuel?.notes ? [selectedFuel.notes] : [],
      uniqueNames: selectedFuel?.name ? [selectedFuel.name] : []
    };
  }

  return {
    items: [{ ...selectedFuel, quantity: actualServingsTotal }],
    totalCarbs: round(selectedFuel.carbsPerServing * actualServingsTotal, 1),
    totalSodium: round(selectedFuel.sodiumPerServing * actualServingsTotal, 0),
    totalCalories: round((selectedFuel.calories ?? 0) * actualServingsTotal, 0),
    totalServings: actualServingsTotal,
    hasDualTransport: selectedFuel.transportType === "dual",
    hasHydrogel: selectedFuel.fuelType === "hydrogel",
    hasStandardSugar: selectedFuel.fuelType !== "hydrogel",
    hasMixedHydrogelKit: false,
    uniqueNotes: selectedFuel.notes ? [selectedFuel.notes] : [],
    uniqueNames: selectedFuel.name ? [selectedFuel.name] : []
  };
}

function getFuelKitAbsorptionCap(fuelSummary, gutToleranceGHr) {
  const transportCap = fuelSummary.hasDualTransport ? 100 : 60;
  return clamp(Math.min(gutToleranceGHr ?? transportCap, transportCap), 0, transportCap);
}

function buildFuelTimesInWindow(startMinute, endMinute, servingCount) {
  if (servingCount <= 0) {
    return [];
  }

  if (servingCount === 1) {
    return [clamp(roundToNearest((startMinute + endMinute) / 2, 5), startMinute, endMinute)];
  }

  const times = [];
  for (let index = 0; index < servingCount; index += 1) {
    const rawMinute = startMinute + ((endMinute - startMinute) * (index + 1)) / (servingCount + 1);
    const roundedMinute = clamp(roundToNearest(rawMinute, 5), startMinute, endMinute);
    const previous = times.at(-1);
    const safeMinute = previous && roundedMinute <= previous ? previous + 5 : roundedMinute;
    times.push(Math.min(safeMinute, endMinute));
  }
  return times;
}

function buildKitFuelTimeline({ durationMinutes, targetCarbsHr, totalCarbs, mode, fuelingKit }) {
  const fuelSummary = summarizeFuelingKit(fuelingKit);
  const units = expandFuelingKit(fuelingKit).sort((left, right) => {
    const priorityDifference =
      (TIMELINE_TYPE_PRIORITY[left.fuelType] ?? 1) - (TIMELINE_TYPE_PRIORITY[right.fuelType] ?? 1);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return left.addedOrder - right.addedOrder;
  });

  if (mode === "none" || units.length === 0) {
    return {
      events: [],
      actualCarbsTotal: 0,
      actualCarbsHr: 0,
      actualServingsTotal: 0,
      totalSodium: 0,
      timelineWarning: null
    };
  }

  const earlyUnits = units.filter((unit) => unit.fuelType !== "hydrogel");
  const lateUnits = units.filter((unit) => unit.fuelType === "hydrogel");
  let timelineWarning = null;
  let times = [];

  if (fuelSummary.hasMixedHydrogelKit && earlyUnits.length && lateUnits.length) {
    const earlyEnd = Math.max(20, Math.min(roundToNearest(durationMinutes * 0.45, 5), Math.max(durationMinutes - 30, 20)));
    const lateStart = Math.max(earlyEnd + 20, roundToNearest(durationMinutes * 0.65, 5));
    const lateEnd = Math.max(durationMinutes - 5, lateStart);

    if (lateStart >= durationMinutes - 5) {
      timelineWarning =
        "This kit mixes hydrogels with standard sugars or solids, but the run is too short to keep them 20 to 30 minutes apart cleanly. Simplify the kit if your stomach is sensitive.";
      times = buildFuelTimes(durationMinutes, units.length);
    } else {
      const earlyTimes = buildFuelTimesInWindow(15, earlyEnd, earlyUnits.length);
      const lateTimes = buildFuelTimesInWindow(lateStart, lateEnd, lateUnits.length);
      if (earlyTimes.length && lateTimes.length && lateTimes[0] - earlyTimes.at(-1) < 20) {
        timelineWarning =
          "This kit mixes hydrogels with standard sugars or solids, and the spacing is tighter than ideal. Keep those fuels 20 to 30 minutes apart when possible.";
      }
      times = [...earlyTimes, ...lateTimes];
    }
  } else {
    times = buildFuelTimes(durationMinutes, units.length);
  }

  const events = units.map((unit, index) => ({
    minute: times[index],
    servings: 1,
    carbs: unit.carbsPerServing,
    sodium: unit.sodiumPerServing,
    fuelType: unit.fuelType,
    name: unit.name,
    label: `1 serving of ${unit.name}`
  }));

  const durationHours = durationMinutes / 60;
  return {
    events,
    actualCarbsTotal: fuelSummary.totalCarbs,
    actualCarbsHr: durationHours > 0 ? round(fuelSummary.totalCarbs / durationHours, 1) : 0,
    actualServingsTotal: fuelSummary.totalServings,
    totalSodium: fuelSummary.totalSodium,
    timelineWarning
  };
}

function selectPreStartFuelItem(fuelingKit) {
  return normalizeFuelingKit(fuelingKit)
    .slice()
    .sort((left, right) => {
      const priorityDifference =
        (PRESTART_TYPE_PRIORITY[left.fuelType] ?? 1) - (PRESTART_TYPE_PRIORITY[right.fuelType] ?? 1);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }
      return left.addedOrder - right.addedOrder;
    })[0] ?? null;
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
  totalCarbsGoal,
  actualCarbsHr,
  actualCarbsTotal,
  durationHours,
  fuelSummary,
  acclimatizationDays,
  targetFluidLHr,
  timelineWarning
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

  if (targetCarbsHr > 60 && !fuelSummary.hasDualTransport) {
    warnings.push({
      tone: "warn",
      text: "Your kit does not include a dual-transport carbohydrate source, so practical intake is capped closer to 60 g/hr."
    });
  }

  if (fuelSummary.hasMixedHydrogelKit) {
    warnings.push({
      tone: "warn",
      text: "This kit mixes hydrogels with standard sugars or solids. Keep those fuels separated instead of stacking them together."
    });
  }

  const actualCarbsGoal = totalCarbsGoal || targetCarbsHr * durationHours;
  if (actualCarbsGoal > 0 && actualCarbsTotal < actualCarbsGoal * 0.9) {
    warnings.push({
      tone: "warn",
      text: `Your selected kit provides ${round(actualCarbsTotal, 0)} g of carbohydrate, but this run calls for about ${round(actualCarbsGoal, 0)} g. Add more fuel so the plan does not come up short.`
    });
  }

  if ((actualCarbsGoal > 0 && actualCarbsTotal > actualCarbsGoal * 1.1) || (targetCarbsHr > 0 && actualCarbsHr > targetCarbsHr + 10)) {
    warnings.push({
      tone: "warn",
      text: `Your selected kit delivers ${round(actualCarbsTotal, 0)} g of carbohydrate, which is above the practical target for this run and may increase GI risk. Remove an item if you want a tighter match.`
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

  if (timelineWarning) {
    warnings.push({
      tone: "warn",
      text: timelineWarning
    });
  }

  return warnings;
}

export function buildRunPlan(profile, run, fuelingInput) {
  const durationMinutes = run.durationMinutes || estimateDurationMinutes(run);
  const durationHours = durationMinutes / 60;
  const heatIndexC = computeHeatIndexC(run.temperatureC, run.humidityPercent);
  const wbgtC = approximateWBGTC(run.temperatureC, run.humidityPercent);
  const heatCategory = getHeatCategory(heatIndexC);
  const fuelPlanInput = normalizeFuelPlanInput(fuelingInput);
  const initialFuelSummary =
    fuelPlanInput.mode === "multiple"
      ? summarizeFuelingKit(fuelPlanInput.fuelingKit)
      : summarizeSingleFuelPlan(fuelPlanInput.selectedFuel, 0);

  const baseFueling = pickBaseCarbTarget(run.runType, durationMinutes);
  const requestedCarbsHr =
    baseFueling.mode === "hourly"
      ? fuelPlanInput.mode === "multiple"
        ? clamp(baseFueling.targetCarbsHr, 0, getFuelKitAbsorptionCap(initialFuelSummary, profile.gutToleranceGHr))
        : clampFuelByTransport(baseFueling.targetCarbsHr, fuelPlanInput.selectedFuel, profile.gutToleranceGHr)
      : 0;
  const totalCarbsGoal =
    baseFueling.mode === "fixed" ? baseFueling.totalCarbs : round(requestedCarbsHr * durationHours, 1);
  const fuelTimeline =
    fuelPlanInput.mode === "multiple"
      ? buildKitFuelTimeline({
          durationMinutes,
          targetCarbsHr: requestedCarbsHr,
          totalCarbs: totalCarbsGoal,
          mode: baseFueling.mode,
          fuelingKit: fuelPlanInput.fuelingKit
        })
      : makeFuelTimeline({
          durationMinutes,
          targetCarbsHr: requestedCarbsHr,
          totalCarbs: totalCarbsGoal,
          mode: baseFueling.mode,
          fuel: fuelPlanInput.selectedFuel
        });
  const fuelSummary =
    fuelPlanInput.mode === "multiple"
      ? summarizeFuelingKit(fuelPlanInput.fuelingKit)
      : summarizeSingleFuelPlan(fuelPlanInput.selectedFuel, fuelTimeline.actualServingsTotal);
  const preStartFuel =
    fuelPlanInput.mode === "multiple"
      ? getPreStartFuelRecommendation(run.runType, durationMinutes, fuelPlanInput.fuelingKit)
      : getPreStartFuelRecommendation(run.runType, durationMinutes, [fuelPlanInput.selectedFuel].filter(Boolean));

  const sodiumBase = SODIUM_BY_SWEATER[profile.sweatSaltiness] ?? SODIUM_BY_SWEATER.average;
  const heatSodiumModifier = heatCategory === "danger" || heatCategory === "very-high" ? 350 : heatCategory === "high" ? 200 : 0;
  const acclimatizationModifier = run.acclimatizationDays < 5 && heatIndexC > 29.5 ? 100 : 0;
  const targetSodiumMgHr = sodiumBase + heatSodiumModifier + acclimatizationModifier;

  const targetFluidLHr = getGuidelineFluidTargetLHr(profile, run, heatIndexC, heatCategory, durationMinutes);

  const scheduledFuelSodiumMg = fuelTimeline.totalSodium;
  const fuelSodiumMgHr = durationHours > 0 ? round(scheduledFuelSodiumMg / durationHours, 0) : 0;
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
    totalCarbsGoal,
    actualCarbsHr: fuelTimeline.actualCarbsHr,
    actualCarbsTotal: fuelTimeline.actualCarbsTotal,
    durationHours,
    fuelSummary,
    acclimatizationDays: run.acclimatizationDays,
    targetFluidLHr,
    timelineWarning: fuelTimeline.timelineWarning
  });

  return {
    fuelPlanMode: fuelPlanInput.mode,
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
    scheduledFuelSodiumMg,
    fuelSodiumMgHr,
    fuelKitSummary: fuelSummary,
    externalSodiumMgHr: plannedExternalSodiumMgHr,
    totalExternalSodiumMg: alignedHydrationPlan.totalExternalSodiumMg,
    totalFluidL: round(alignedHydrationPlan.totalWaterMl / 1000, 2),
    totalWaterMl: alignedHydrationPlan.totalWaterMl,
    fuelTimeline,
    preStartFuel,
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

function mapEventsToRoxzones(events, roxzones, windowMinutes = 12) {
  const reserved = new Set();

  return events.map((event) => {
    const nearest = roxzones
      .map((roxzone) => ({
        roxzone,
        difference: Math.abs(roxzone.minute - event.minute)
      }))
      .filter(({ roxzone, difference }) => difference <= windowMinutes && !reserved.has(roxzone.key))
      .sort((left, right) => left.difference - right.difference)[0];

    if (!nearest) {
      return {
        ...event,
        roxzoneLabel: null
      };
    }

    reserved.add(nearest.roxzone.key);
    return {
      ...event,
      minute: nearest.roxzone.minute,
      roxzoneLabel: nearest.roxzone.label,
      stationName: nearest.roxzone.stationName
    };
  });
}

function buildHyroxHydrationPlan(profile, durationMinutes, roxzones, fuelSodiumTotal) {
  const durationHours = durationMinutes / 60;
  const baseSweatRate = Math.max(profile.sweatRateLHr, profile.sex === "male" ? 0.95 : 0.85);
  const targetFluidLHr = clamp(baseSweatRate * 0.75, 0.45, 0.85);
  const intervalMinutes = durationMinutes > 90 || profile.sweatRateLHr > 1.0 ? 15 : 20;
  const eventCount = Math.max(1, Math.ceil(durationMinutes / intervalMinutes));
  const sipMl = clamp(roundToNearest((targetFluidLHr * durationHours * 1000) / eventCount, 10), 150, 250);
  const totalWaterMl = sipMl * eventCount;
  const flaskVolumeMl = 500;
  const sodiumBySweater = {
    low: 350,
    average: 500,
    salty: 850
  };
  const targetSodiumMgHr = sodiumBySweater[profile.sweatSaltiness] ?? sodiumBySweater.average;
  const totalSodiumGoal = round(targetSodiumMgHr * durationHours, 0);
  const externalSodiumMg = Math.max(round(totalSodiumGoal - fuelSodiumTotal, 0), 0);
  const sodiumPer500MlFlask =
    totalWaterMl > 0 ? roundToNearest((externalSodiumMg / totalWaterMl) * flaskVolumeMl, 25) : 0;
  const plannedExternalSodiumMg = round((sodiumPer500MlFlask / flaskVolumeMl) * totalWaterMl, 0);
  const minuteEvents = [];

  for (let index = 1; index <= eventCount; index += 1) {
    minuteEvents.push({
      minute: Math.min(index * intervalMinutes, durationMinutes),
      sipMl,
      sipFlaskFraction: round(sipMl / flaskVolumeMl, 2)
    });
  }

  const events = mapEventsToRoxzones(minuteEvents, roxzones);

  return {
    targetFluidLHr: round(targetFluidLHr, 2),
    intervalMinutes,
    sipMl,
    totalWaterMl,
    totalFluidL: round(totalWaterMl / 1000, 2),
    sodiumPer500MlFlask,
    totalExternalSodiumMg: plannedExternalSodiumMg,
    flaskCountEquivalent: round(totalWaterMl / flaskVolumeMl, 2),
    flaskCountToCarry: Math.max(1, Math.ceil(totalWaterMl / flaskVolumeMl)),
    events
  };
}

function assignHyroxFuelEventsToRoxzones(remainingUnits, roxzones, predictedDurationMinutes) {
  if (!remainingUnits.length) {
    return [];
  }

  const preferredIndexSets = {
    1: [3],
    2: [3, 5],
    3: [1, 3, 5],
    4: [1, 3, 5, 7]
  };
  const preferredIndices = preferredIndexSets[remainingUnits.length] ?? [];
  const preferredRoxzones = preferredIndices
    .map((index) => roxzones[index])
    .filter(Boolean);

  if (preferredRoxzones.length === remainingUnits.length) {
    return remainingUnits.map((unit, index) => ({
      minute: preferredRoxzones[index].minute,
      name: unit.name,
      carbs: unit.carbsPerServing,
      roxzoneLabel: preferredRoxzones[index].label,
      stationName: preferredRoxzones[index].stationName
    }));
  }

  const distributionTimes = buildFuelTimes(predictedDurationMinutes, remainingUnits.length);
  return mapEventsToRoxzones(
    remainingUnits.map((unit, index) => ({
      minute: distributionTimes[index],
      name: unit.name,
      carbs: unit.carbsPerServing
    })),
    roxzones
  );
}

function buildSingleFuelHyroxPlan(selectedFuel, predictedDurationMinutes, roxzones) {
  if (!selectedFuel) {
    return {
      fuelEvents: [],
      fuelSummary: summarizeSingleFuelPlan(null, 0)
    };
  }

  let midRaceServings = 0;
  if (predictedDurationMinutes >= 75 && predictedDurationMinutes < 90) {
    midRaceServings = 1;
  } else if (predictedDurationMinutes >= 90 && predictedDurationMinutes <= 120) {
    midRaceServings = 2;
  } else if (predictedDurationMinutes > 120) {
    midRaceServings = 3;
  }

  const repeatedUnits = Array.from({ length: midRaceServings }, () => ({
    ...selectedFuel,
    name: selectedFuel.name,
    carbsPerServing: selectedFuel.carbsPerServing
  }));
  const distributedEvents = assignHyroxFuelEventsToRoxzones(repeatedUnits, roxzones, predictedDurationMinutes);
  const fuelEvents = [
    {
      minute: -15,
      label:
        predictedDurationMinutes < 75
          ? `Take 1 serving of ${selectedFuel.name} 15 to 30 minutes before the start. Ideally this is a caffeine gel if you tolerate caffeine well, but avoid taking it too early while you are still waiting around.`
          : `Take 1 serving of ${selectedFuel.name} 10 to 15 minutes before the start with a few mouthfuls of water. Avoid taking it too early while you are still standing around, or you risk a rebound blood-sugar dip on the line.`,
      roxzoneLabel: "Pre-start"
    }
  ];

  distributedEvents.forEach((event) => {
    fuelEvents.push({
      minute: event.minute,
      label: `Take 1 serving of ${event.name}${event.roxzoneLabel ? ` during ${event.roxzoneLabel}` : ""}.`,
      roxzoneLabel: event.roxzoneLabel
    });
  });

  return {
    fuelEvents,
    fuelSummary: summarizeSingleFuelPlan(selectedFuel, 1 + midRaceServings)
  };
}

export function buildHyroxPlan(profile, settings, fuelingInput) {
  const runLegMinutes = settings.runPaceMinPerKm;
  const transitionMinutes = settings.transitionSeconds / 60;
  const stationEstimates = settings.stationEstimates.map((station) => ({
    ...station,
    minutes: Number(station.minutes)
  }));
  const runTotalMinutes = round(runLegMinutes * 8, 1);
  const stationTotalMinutes = round(stationEstimates.reduce((sum, station) => sum + station.minutes, 0), 1);
  const roxzoneTotalMinutes = round(transitionMinutes * 8, 1);

  let cumulativeMinute = 0;
  const breakdown = [];
  const roxzones = [];

  stationEstimates.forEach((station, index) => {
    const runNumber = index + 1;
    const runStart = cumulativeMinute;
    cumulativeMinute += runLegMinutes;
    breakdown.push({
      label: `Run ${runNumber}`,
      type: "run",
      startMinute: round(runStart, 1),
      endMinute: round(cumulativeMinute, 1),
      detail: `${runNumber} km run`
    });

    const stationStart = cumulativeMinute;
    cumulativeMinute += station.minutes;
    breakdown.push({
      label: station.name,
      type: "station",
      startMinute: round(stationStart, 1),
      endMinute: round(cumulativeMinute, 1),
      detail: `${formatClock(station.minutes)} estimated station time`
    });

    const roxzoneStart = cumulativeMinute;
    cumulativeMinute += transitionMinutes;
    const roxzoneEnd = cumulativeMinute;
    const roxzoneLabel = `Roxzone after ${station.name}`;
    roxzones.push({
      key: `roxzone-${runNumber}`,
      minute: round(roxzoneEnd, 0),
      label: roxzoneLabel,
      stationName: station.name
    });
    breakdown.push({
      label: `Roxzone ${runNumber}`,
      type: "roxzone",
      startMinute: round(roxzoneStart, 1),
      endMinute: round(roxzoneEnd, 1),
      detail: `${formatClock(settings.transitionSeconds / 60)} transition window`
    });
  });

  const predictedDurationMinutes = round(cumulativeMinute, 0);
  const durationHours = predictedDurationMinutes / 60;
  const fuelPlanInput = normalizeFuelPlanInput(fuelingInput);
  const carbLoadingRange = [round(profile.weightKg * 7, 0), round(profile.weightKg * 10, 0)];
  const raceMorningRange = [round(profile.weightKg * 1, 0), round(profile.weightKg * 4, 0)];

  let targetCarbsHr = 0;
  if (predictedDurationMinutes >= 75) {
    targetCarbsHr = predictedDurationMinutes > 105 ? 60 : predictedDurationMinutes > 90 ? 45 : 30;
  }

  let fuelEvents = [];
  let fuelSummary;

  if (fuelPlanInput.mode === "multiple") {
    const expandedKit = expandFuelingKit(fuelPlanInput.fuelingKit).sort((left, right) => {
      const priorityDifference =
        (TIMELINE_TYPE_PRIORITY[left.fuelType] ?? 1) - (TIMELINE_TYPE_PRIORITY[right.fuelType] ?? 1);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }
      return left.addedOrder - right.addedOrder;
    });
    const preStartItem = selectPreStartFuelItem(fuelPlanInput.fuelingKit);
    const remainingUnits = [...expandedKit];
    if (preStartItem) {
      const preStartIndex = remainingUnits.findIndex((unit) => unit.name === preStartItem.name && unit.addedOrder === preStartItem.addedOrder);
      if (preStartIndex >= 0) {
        remainingUnits.splice(preStartIndex, 1);
      }
    }

    const distributedEvents = assignHyroxFuelEventsToRoxzones(
      remainingUnits,
      roxzones,
      predictedDurationMinutes
    );
    fuelEvents = [];

    if (preStartItem) {
      fuelEvents.push({
        minute: -15,
        label:
          predictedDurationMinutes < 75
            ? `Take 1 serving of ${preStartItem.name} 15 to 30 minutes before the start. Ideally this is a caffeine gel if you tolerate caffeine well, but avoid taking it too early while you are still waiting around.`
            : `Take 1 serving of ${preStartItem.name} 10 to 15 minutes before the start with a few mouthfuls of water. Avoid taking it too early while you are still standing around, or you risk a rebound blood-sugar dip on the line.`,
        roxzoneLabel: "Pre-start"
      });
    }

    distributedEvents.forEach((event) => {
      fuelEvents.push({
        minute: event.minute,
        label: `Take 1 serving of ${event.name}${event.roxzoneLabel ? ` during ${event.roxzoneLabel}` : ""}.`,
        roxzoneLabel: event.roxzoneLabel
      });
    });
    fuelSummary = summarizeFuelingKit(fuelPlanInput.fuelingKit);
  } else {
    const singleFuelPlan = buildSingleFuelHyroxPlan(
      fuelPlanInput.selectedFuel,
      predictedDurationMinutes,
      roxzones
    );
    fuelEvents = singleFuelPlan.fuelEvents;
    fuelSummary = singleFuelPlan.fuelSummary;
  }

  const actualCarbsTotal = fuelSummary.totalCarbs;
  const hydrationPlan = buildHyroxHydrationPlan(profile, predictedDurationMinutes, roxzones, fuelSummary.totalSodium);
  const projectedNetFluidLossL = Math.max(Math.max(profile.sweatRateLHr, 0.85) - hydrationPlan.targetFluidLHr, 0) * durationHours;
  const bodyMassLossPercent = (projectedNetFluidLossL / profile.weightKg) * 100;

  const warnings = [
    {
      tone: "warn",
      text: "HYROX is indoor and standardized, so outdoor weather is ignored here. The planner assumes a relatively sweaty indoor environment and prioritizes electrolyte pre-loading."
    },
    {
      tone: predictedDurationMinutes > 95 ? "warn" : "success",
      text:
        predictedDurationMinutes > 95
          ? "Predicted duration pushes beyond the typical 60 to 90-minute HYROX window, so mid-race fueling becomes much more important."
          : "Predicted duration sits inside the common HYROX racing window. Pre-race setup remains the biggest performance lever."
    }
  ];

  if (bodyMassLossPercent > 2) {
    warnings.push({
      tone: "danger",
      text: `Even with the planned drinks, projected body-mass loss is about ${round(bodyMassLossPercent, 1)}%. Tighten Roxzone drinking execution if that feels realistic for you.`
    });
  }

  if (targetCarbsHr > 0) {
    const totalTarget = round(targetCarbsHr * durationHours, 0);
    if (actualCarbsTotal < totalTarget * 0.9) {
      warnings.push({
        tone: "warn",
        text: `Your race kit provides ${round(actualCarbsTotal, 0)} g of carbohydrate, but this HYROX effort calls for about ${totalTarget} g. Add more items if you want a closer match.`
      });
    } else if (actualCarbsTotal > totalTarget * 1.1) {
      warnings.push({
        tone: "warn",
        text: `Your race kit overshoots the practical carbohydrate target for this HYROX plan and may increase GI risk. Consider removing an item.`
      });
    }
  }

  if (fuelSummary.hasMixedHydrogelKit) {
    warnings.push({
      tone: "warn",
      text: "This kit mixes hydrogels with standard sugars or solids. Keep those items separated rather than taking them together in the same Roxzone window."
    });
  }

  return {
    fuelPlanMode: fuelPlanInput.mode,
    predictedDurationMinutes,
    durationHours,
    runTotalMinutes,
    stationTotalMinutes,
    roxzoneTotalMinutes,
    carbLoadingRange,
    raceMorningRange,
    targetCarbsHr,
    fuelKitSummary: fuelSummary,
    actualCarbsTotal,
    actualCarbsHr: durationHours > 0 ? round(actualCarbsTotal / durationHours, 1) : 0,
    fuelEvents,
    hydrationPlan,
    breakdown,
    warnings,
    bodyMassLossPercent: round(bodyMassLossPercent, 1),
    dailyTargets: [
      "Start carbohydrate loading 48 to 72 hours before race day while tapering training volume.",
      `Target ${carbLoadingRange[0]} to ${carbLoadingRange[1]} g carbohydrate per day during the loading phase.`,
      "A temporary 0.9 to 1.8 kg gain during carb loading is normal and useful because stored glycogen pulls water with it."
    ],
    foodsToEat: [
      "White rice, pasta, potatoes, and sweet potatoes for easy glycogen loading.",
      "Sourdough or white bread, bagels, oats, bananas, honey, and jam.",
      "Sports drinks, liquid carbohydrates, or chews if solid food feels too heavy."
    ],
    foodsToAvoid: [
      "Reduce fiber and fat in the final 48 hours to protect digestion and improve carbohydrate storage.",
      "Avoid broccoli and other cruciferous vegetables, lentils, bran, and heavy sauces.",
      "Avoid unfamiliar foods or any race-week experiment you have not tested in training."
    ],
    timingProtocol: [
      {
        label: "48 to 72 hours out",
        text: "Spread carbohydrates across 3 main meals plus 3 to 4 high-carb snacks each day instead of one giant loading meal."
      },
      {
        label: "Night before",
        text: "Eat a moderate, familiar carb-rich meal and finish 3 to 4 hours before bed so digestion does not disrupt sleep. Also drink 500 mL of a strong electrolyte drink that evening."
      },
      {
        label: "Race morning",
        text: `Take ${raceMorningRange[0]} to ${raceMorningRange[1]} g carbohydrate 3 to 4 hours before the start with essentially zero fat and zero fiber. Then drink another 500 mL electrolyte bottle about 90 minutes before the gun.`
      },
      {
        label: "60 to 90 minutes pre-start",
        text: "Top up with 30 to 50 g of simple carbohydrates from a sports drink or chews if you want a lighter final top-off before the start."
      }
    ]
  };
}
