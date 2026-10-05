export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

// Dos franjas chocan si son el mismo dia y sus horas se solapan (HH:mm se compara como texto)
export const slotsOverlap = (a: TimeSlot, b: TimeSlot): boolean =>
  a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime;
