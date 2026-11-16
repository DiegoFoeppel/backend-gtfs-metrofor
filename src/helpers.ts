export function isAfterTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const targetMinutes = hours * 60 + minutes;

  return currentMinutes <= targetMinutes;
}
