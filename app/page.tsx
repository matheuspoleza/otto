import { getDemoPRs } from './_lib/demos';
import { Landing } from './_pages/Landing/Landing.page';

export default async function Home() {
  const demos = await getDemoPRs();
  return <Landing demos={demos} />;
}
