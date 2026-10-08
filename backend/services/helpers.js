export function cairoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDate(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function isValidTeacherPhoto(photo) {
  return (
    typeof photo === "string" &&
    photo.length <= 2_100_000 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)
  );
}

export const fixedGradeLabels = {
  first: "الأول الثانوي",
  second: "الثاني الثانوي",
  third: "الثالث الثانوي",
};

export const normalizeGroupGrade = (gradeLevel, fallbackGrade = "") => {
  const normalized = String(gradeLevel || "").trim();
  if (normalized && fixedGradeLabels[normalized])
    return fixedGradeLabels[normalized];
  if (normalized && !["first", "second", "third"].includes(normalized))
    return normalized;
  const current = String(fallbackGrade || "").trim();
  if (current && !Object.values(fixedGradeLabels).includes(current))
    return current;
  return current && Object.values(fixedGradeLabels).includes(current)
    ? current
    : "الثالث الثانوي";
};
