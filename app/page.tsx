import { PRLens } from './_pages/PRLens/PRLens.page';
import { samplePR } from './_fixtures/samplePR';

export default function Home() {
  return <PRLens data={samplePR} />;
}
