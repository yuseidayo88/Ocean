'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref, useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Diamond, Icon, type IconName } from '@/components/ui/Icon';
import { TASKS, TASK_BODY, employee, work, type State, type Task } from '@/lib/dummy';
import { pressable } from '@/lib/a11y';
import { COMPOSER_H } from '@/lib/design/tokens';

/**
 * タスク＝**いつやるかで束ねる**（参考: Todoist Upcoming / Attio Tasks / Evernote Tasks —
 * どれも一覧ではなく期限の束で並べている）。
 *
 * 前は1枚の表で、放っておけない順に並べていた。順番は正しかったが、
 * 「いつまでに何をすればいいか」が読み取れなかった（期限の列を目で追う必要があった）。
 *
 * ・**判断待ちは行から出す。** あなたが決めるものは束の外、いちばん上の帯に置く
 * ・束は きょう / あした / 今週のうち。空の束は出さない
 * ・**完了は下の1行に畳む**（下に溜めない）
 * ・「追加」ボタンは置かない。タスクは統括AIとの会話から作られる
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663';

/** ダミーの「きょう」。実データでは new Date() に置き換わる */
const TODAY = '8月21日', TOMORROW = '8月22日';

type Bunch = { key: string; label: string; date?: string; items: Task[] };

/** 期限で束ねる。**空の束は作らない** */
function bunches(): Bunch[] {
  const live = TASKS.filter((t) => t.state !== '完了' && t.state !== '判断待ち');
  const out: Bunch[] = [
    { key: 'today', label: 'きょう', date: TODAY, items: live.filter((t) => t.due === TODAY) },
    { key: 'tomorrow', label: 'あした', date: TOMORROW, items: live.filter((t) => t.due === TOMORROW) },
    { key: 'week', label: '今週のうち', items: live.filter((t) => t.due !== TODAY && t.due !== TOMORROW) },
  ];
  return out.filter((b) => b.items.length > 0);
}

function Mark({ s }: { s: State }) {
  if (s === '要確認') return <Icon name="deliv" color={AMBER_T} size={13} />;
  if (s === '実行中') return <span style={{ width: 7, height: 7, borderRadius: 999, background: '#6E6E6E', display: 'inline-block' }} />;
  if (s === '完了') return <Icon name="check" color="#3A3A3A" size={12} width={2} />;
  return <span style={{ width: 7, height: 7, borderRadius: 999, border: '1px solid #333', display: 'inline-block' }} />;
}

export default function TasksPage() {
  const [openId, setOpen] = useOpen();
  // 畳んだ完了は URL に持つ（別の画面から戻っても開いたまま）
  const [doneOpen, setDoneOpen] = useParam('done', '');
  const open = TASKS.find((t) => t.id === openId) ?? null;

  const gate = TASKS.find((t) => t.state === '判断待ち') ?? null;
  const done = TASKS.filter((t) => t.state === '完了');
  const live = TASKS.filter((t) => t.state !== '完了');
  const todayRest = live.filter((t) => t.due === TODAY && t.state !== '判断待ち').length;

  return (
    <>
    <Centre>
      <TopBar title="タスク"
        onPanel={() => setOpen(TASKS[0].id)} panelOn={!!open}
        right={
          <span style={{ color: T5, fontSize: 12 }} className="tnum">
            やること {live.length} · 完了 {done.length}
          </span>
        } />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `16px 26px ${COMPOSER_H}px` }}>
        {/* 答えを先に1行。図はそのあと（進捗の画面と同じ作法） */}
        <div style={{ fontSize: 16, lineHeight: '26px', paddingBottom: 16 }}>
          {gate
            ? <>今日じゅうに<span style={{ color: AMBER_T }}>決めるのが1件</span>。ほかの{todayRest}件は走っています。</>
            : <>決めるものはありません。{todayRest}件が走っています。</>}
        </div>

        {/* 判断待ちは束に入れない。あなたが決めるものだけ、面と枠を持つ */}
        {gate && <GateBand t={gate} on={gate.id === openId} onOpen={() => setOpen(gate.id)} />}

        {bunches().map((b) => (
          <div key={b.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, height: 40, paddingTop: 10 }}>
              <span style={{ color: b.key === 'today' ? AMBER_T : T3, fontSize: 12 }}>{b.label}</span>
              {b.date && <span style={{ color: b.key === 'today' ? AMBER_T : T5, fontSize: 12 }}>{b.date}</span>}
              <span style={{ color: '#3A3A3A', fontSize: 11 }} className="tnum">{b.items.length}</span>
            </div>
            {b.items.map((t) => <Row key={t.id} t={t} on={t.id === openId} onOpen={() => setOpen(t.id)} />)}
          </div>
        ))}

        {/* 終わったものは下に溜めない。1行に畳んで、押したときだけ開く */}
        {done.length > 0 && (
          <div style={{ paddingTop: 22 }}>
            <div className="row" {...pressable(() => setDoneOpen(doneOpen ? '' : '1'))} style={{
              display: 'flex', alignItems: 'center', gap: 11, height: 40, padding: '0 12px',
              borderRadius: 8, background: '#0B0B0B',
            }}>
              <Icon name="check" color="#3A3A3A" size={13} width={2} />
              <span style={{ color: T4, fontSize: 12.5 }}>終わったもの</span>
              <span style={{ color: T5, fontSize: 12 }} className="tnum">{done.length}件</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>{doneOpen ? '畳む ›' : '開く ›'}</span>
            </div>
            {doneOpen && done.map((t) => <Row key={t.id} t={t} on={t.id === openId} onOpen={() => setOpen(t.id)} />)}
          </div>
        )}
      </div>

      <Composer placeholder="統括AIに頼む" />
    </Centre>

    {open && <TaskPane t={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * 束の中の1行。**状態の列を置かない**（印がタイトルの前にある）。
 * 事実は右に並べる — 進捗のバー / 担当 / どの Work か。
 */
function Row({ t, on, onOpen }: { t: Task; on: boolean; onOpen: () => void }) {
  const fin = t.state === '完了';
  const who = t.owner === 'me' ? 'あなた' : employee(t.owner).name;
  return (
    <div className="row" {...pressable(onOpen)} style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 43,
      borderTop: '1px solid #161616', background: on ? '#0C0C0C' : undefined,
    }}>
      <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
        <Mark s={t.state} />
      </span>
      <span style={{
        flex: 1, minWidth: 0, color: fin ? T5 : T1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{t.title}</span>
      <span style={{ width: 74, height: 3, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden', flexShrink: 0 }}>
        <span style={{
          display: 'block', width: `${t.progress}%`, height: '100%', borderRadius: 2,
          background: t.state === '要確認' ? AMBER : fin ? '#262626' : '#5F5F5F',
        }} />
      </span>
      {/* 行は開く、中のリンクは別の画面へ。食い合わないように止める */}
      {t.owner === 'me'
        ? <span style={{ width: 76, flexShrink: 0, color: AMBER_T, fontSize: 12 }}>{who}</span>
        : <Link href={openHref('/team', t.owner)} onClick={(e) => e.stopPropagation()} className="lnk"
            style={{ width: 76, flexShrink: 0, color: T4, fontSize: 12 }}>{who}</Link>}
      <Link href={`/work/${t.workId}`} onClick={(e) => e.stopPropagation()} className="lnk" style={{
        width: 140, flexShrink: 0, textAlign: 'right', color: fin ? '#3A3A3A' : T5, fontSize: 12,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{work(t.workId).title}</Link>
    </div>
  );
}

/** あなたが決めるもの。**束の外に出して、いちばん上に置く** */
function GateBand({ t, on, onOpen }: { t: Task; on: boolean; onOpen: () => void }) {
  return (
    <div className="row" {...pressable(onOpen)} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12,
      background: on ? 'rgba(227,116,0,0.10)' : 'rgba(227,116,0,0.055)',
      border: '1px solid rgba(227,116,0,0.42)',
    }}>
      <Diamond size={11} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
        <span style={{ color: T5, fontSize: 11.5 }}>
          {work(t.workId).title} · フェーズ{work(t.workId).phaseIndex} · {TASK_BODY.created.replace('前', '')} 待っています
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ color: T4, fontSize: 12, whiteSpace: 'nowrap' }}>
        {TASK_BODY.rows.map((r) => `${r.k} ${r.v}`).join(' / ')}
      </span>
      <span className="solid" style={{
        display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 16px',
        borderRadius: 8, background: AMBER, color: '#fff', flexShrink: 0,
      }}>決める</span>
    </div>
  );
}

/**
 * 1行を開いた先。**押した行のものを出す。**
 * フィールドとシステムはどの行にもあるが、案の比較は判断待ちの行にしかない。
 */
function TaskPane({ t, onClose }: { t: Task; onClose: () => void }) {
  const b = TASK_BODY;
  const gate = t.state === '判断待ち';
  const who = t.owner === 'me' ? 'あなた' : employee(t.owner).name;
  const barColor = gate || t.state === '要確認' ? AMBER : t.state === '完了' ? '#1E8E3E' : '#6E6E6E';
  const fields = [
    { icon: 'task' as const, label: '期限', value: t.due },
    { icon: 'check' as const, label: '状態', pill: t.state },
    { icon: 'bars' as const, label: '進捗', bar: t.progress },
    { icon: 'team' as const, label: '担当', value: who },
    { icon: 'work' as const, label: 'Work', value: work(t.workId).title },
  ];
  // 値のない行は出さない（「—」で埋めない）
  const system = [
    ...(gate ? [{ icon: 'plus' as const, label: '作成', value: b.created }] : []),
    { icon: 'roadmap' as const, label: 'フェーズ', value: t.phase },
  ];
  return (
    <Pane width={420} onClose={onClose}
      dot={gate || t.state === '要確認' ? AMBER : t.state === '完了' ? '#1E8E3E' : '#5F5F5F'}
      title={t.title}
      right={gate ? <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>{b.created}に作成</span> : undefined}>
      {/* 1つのタスクの中の行き先。**開いた文書ではない**ので、タブではなく選ぶ列 */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 4, padding: '10px 16px 0' }}>
        {(['概要', '履歴', '資料'] as const).map((label, i) => (
          <span key={label} className={i === 0 ? 'hit' : 'btn'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 11px',
            borderRadius: 8, background: i === 0 ? '#1A1A1A' : undefined, color: i === 0 ? T1 : T4, fontSize: 12.5,
          }}>
            <Icon name={i === 0 ? 'home' : i === 1 ? 'history' : 'deliv'} color={i === 0 ? T2 : '#3A3A3A'} size={12} />{label}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 20px' }}>
        <PaneHead top>フィールド</PaneHead>
        {fields.map((f) => (
          <PaneRow key={f.label} icon={f.icon} label={f.label}>
            {'pill' in f && f.pill && (
              gate || f.pill === '要確認' ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                  background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12,
                }}>{f.pill}</span>
              ) : <span style={{ color: T1, fontSize: 12.5 }}>{f.pill}</span>
            )}
            {'bar' in f && f.bar !== undefined && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'block', width: 74, height: 4, borderRadius: 2, background: '#1A1A1A' }}>
                  <span style={{ display: 'block', width: `${f.bar}%`, height: '100%', borderRadius: 2, background: barColor }} />
                </span>
                <span style={{ color: T1, fontSize: 12.5 }} className="tnum">{f.bar}%</span>
              </span>
            )}
            {'value' in f && f.value && <span style={{ color: T1, fontSize: 12.5 }}>{f.value}</span>}
          </PaneRow>
        ))}

        <PaneHead>システム</PaneHead>
        {system.map((f) => (
          <PaneRow key={f.label} icon={f.icon} label={f.label}>
            <span style={{ color: T1, fontSize: 12.5 }}>{f.value}</span>
          </PaneRow>
        ))}

        {gate && <>
        <PaneHead>内容</PaneHead>
        <span style={{ display: 'block', color: T3, fontSize: 12.5, lineHeight: '21px', padding: '4px 0 16px' }}>
          {b.lead}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 24 }}>
          <span style={{ width: 28, color: T5, fontSize: 11 }}>{b.cols[0]}</span>
          <span style={{ flex: 1, color: T5, fontSize: 11 }}>{b.cols[1]}</span>
          <span style={{ color: T5, fontSize: 11 }}>{b.cols[2]}</span>
        </div>
        {b.rows.map((r) => (
          <div key={r.k} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 35, padding: '0 9px', margin: '0 -9px',
            borderRadius: 7, borderTop: '1px solid #161616',
            background: r.on ? 'rgba(30,142,62,0.10)' : undefined,
          }}>
            <span style={{ width: 28, color: r.on ? T1 : T4, fontSize: 12.5 }}>{r.k}</span>
            <span style={{ flex: 1, color: r.on ? T1 : T4, fontSize: 12.5 }} className="tnum">{r.v}</span>
            <span style={{ color: r.on ? '#5BB974' : T5, fontSize: 12.5 }} className="tnum">{r.pct}</span>
          </div>
        ))}
        </>}
      </div>
      <PaneFooter primary={gate ? '判断する' : '開く'} secondary="表示" />
    </Pane>
  );
}

/** ペインのフィールド1行。アイコンは裸で置く */
function PaneRow({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34 }}>
      <Icon name={icon} color="#3A3A3A" size={13} />
      <span style={{ width: 62, color: T5, fontSize: 12.5 }}>{label}</span>
      {children}
    </div>
  );
}
