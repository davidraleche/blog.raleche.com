import { PeopleIndex } from "@/components/PeopleIndex";

export const metadata = { title: "Speakers" };

export default function Speakers() {
  return <PeopleIndex by="speaker" />;
}
