function getSlots(start, end, duration) {
  let cur = new Date(`1970-01-01T${start}:00Z`).getTime();
  const endTime = new Date(`1970-01-01T${end}:00Z`).getTime();
  const dur = duration * 60 * 1000;
  
  const slots = [];
  while (cur + dur <= endTime) {
    const raw = new Date(cur).toISOString().substr(11, 5);
    const h24 = parseInt(raw.split(":")[0]);
    const min = raw.split(":")[1];
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 % 12) || 12).toString().padStart(2, "0");
    slots.push(`${h12}:${min} ${ampm}`);
    cur += dur;
  }
  return slots;
}

console.log(getSlots('09:00', '22:00', 30));
