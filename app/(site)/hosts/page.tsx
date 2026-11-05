import { PeopleIndex } from "@/components/PeopleIndex";

export const metadata = { title: "Hosts", description: "The podcast hosts and interviewers behind the conversations RALECHE covers, with every story from each show.", alternates: { canonical: "/hosts" } };

export default function Hosts() {
  return <PeopleIndex by="host" />;
}
