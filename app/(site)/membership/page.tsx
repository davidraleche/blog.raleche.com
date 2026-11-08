import { permanentRedirect } from "next/navigation";

// Memberships were replaced by tokens.
export default function Membership() {
  permanentRedirect("/store");
}
