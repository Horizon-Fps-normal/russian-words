// Russian stress is represented by combining acute/grave accents. Decomposing and
// deleting every combining mark also corrupts й (и + breve); keep letters intact.
const STRESS_MARKS = /[\u0300\u0301]/g;

export function removeRussianStress(value) {
  return String(value ?? "").normalize("NFD").replace(STRESS_MARKS, "").normalize("NFC");
}

export function normalizeRussian(value) {
  return removeRussianStress(value).trim().toLocaleLowerCase("ru-RU");
}
