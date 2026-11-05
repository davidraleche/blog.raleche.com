import { PeopleIndex } from "@/components/PeopleIndex";

export const metadata = { title: "Speakers", description: "The tech leaders, founders and investors interviewed on RALECHE, with every story and executive summary about each of them.", alternates: { canonical: "/speakers" } };

export default function Speakers() {
  return <PeopleIndex by="speaker" />;
}
