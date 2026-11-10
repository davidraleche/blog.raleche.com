// A readable name for a visitor, made from their visitor cookie (same cookie, same name). Safe in browser code.
const ADJ = ["Amber", "Azure", "Bold", "Brave", "Bright", "Calm", "Clever", "Coral", "Crimson", "Daring", "Eager", "Emerald", "Fierce", "Gentle", "Golden", "Happy", "Ivory", "Jade", "Keen", "Lucky", "Lunar", "Mellow", "Misty", "Noble", "Olive", "Quick", "Quiet", "Rapid", "Royal", "Ruby", "Rustic", "Sage", "Scarlet", "Silver", "Sly", "Solar", "Steady", "Swift", "Teal", "Witty"];
const ANIMAL = ["Badger", "Bear", "Bison", "Cobra", "Condor", "Coyote", "Crane", "Dingo", "Dolphin", "Eagle", "Falcon", "Ferret", "Fox", "Gecko", "Heron", "Ibis", "Jaguar", "Koala", "Lemur", "Lion", "Lynx", "Marten", "Moose", "Narwhal", "Ocelot", "Orca", "Otter", "Owl", "Panda", "Panther", "Puma", "Raven", "Seal", "Shark", "Stork", "Tiger", "Toucan", "Walrus", "Wolf", "Yak"];

export function visitorName(visitorId: string | null | undefined): string {
  if (!visitorId) return "Unknown visitor";
  let h = 2166136261;
  for (let i = 0; i < visitorId.length; i++) h = Math.imul(h ^ visitorId.charCodeAt(i), 16777619) >>> 0;
  const n = h % 10000;
  return `${ADJ[h % ADJ.length]} ${ANIMAL[Math.floor(h / ADJ.length) % ANIMAL.length]} ${String(n).padStart(4, "0")}`;
}
