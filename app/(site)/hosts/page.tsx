import { PeopleIndex } from "@/components/PeopleIndex";

export const metadata = { title: "Hosts" };

export default function Hosts() {
  return <PeopleIndex by="host" />;
}
