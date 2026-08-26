import { hasKey, providerFor, type ModelProvider } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';

/**
 * **統括AIの通り道を選ぶ。**
 *
 * 鍵が無ければ決め打ちのプロバイダ（`real: false`）— 画面には必ず
 * 「これは仮の◯◯です」と出す。**考えていないものを、考えたように見せない。**
 *
 * ここだけの1ファイルにしてあるのは輪を切るため。
 * `lib/exec/run.ts` に置くと、記憶の手入れ（`./memory`）と手順書の審査（`./skills`）が
 * これを使うために run.ts を読み、run.ts が memory.ts を読む輪ができる。
 */
export function pickProvider(): { p: ModelProvider; real: boolean } {
  // 統括AIは deep で走るので、見る鍵も deep の通り道のもの
  if (!hasKey('deep')) return { p: new FakeProvider(), real: false };
  return { p: providerFor('deep'), real: true };
}
