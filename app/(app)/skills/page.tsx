import { Centre, Composer, Section, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { SKILLS } from '@/lib/dummy';

/**
 * スキル ＝ SKILL.md のファイル管理（参考: Base44 の Knowledge files）。
 * 行の先頭にアイコンは置かない（ここにはスキルしか並ばない）。
 * 有効かどうかは青のトグル。追加はセクション見出しの右上。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8';

const Toggle = ({ on }: { on: boolean }) => (
  <span style={{
    width: 34, height: 20, borderRadius: 999, background: on ? BLUE : '#2A2A2A',
    display: 'inline-flex', alignItems: 'center', padding: 2, flexShrink: 0,
  }}>
    <span style={{ width: 16, height: 16, borderRadius: 999, background: '#fff', marginLeft: on ? 14 : 0 }} />
  </span>
);

const Add = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
    <Icon name="plus" color={T4} size={12} />追加
  </span>
);

function Row({ name, file, on, last }: { name: string; file: string; on: boolean; last: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
      borderBottom: last ? undefined : '1px solid #161616',
    }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{file}</span>
      </div>
      <div style={{ flex: 1 }} />
      <Icon name="download" color="#3A3A3A" size={14} />
      <Icon name="edit" color="#3A3A3A" size={14} />
      <Icon name="trash" color="#3A3A3A" size={14} />
      <Toggle on={on} />
    </div>
  );
}

export default function SkillsPage() {
  const mine = SKILLS.filter((s) => s.scope === 'employee');
  const shared = SKILLS.filter((s) => s.scope === 'company');
  return (
    <Centre border={false}>
      <TopBar title="スキル" />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 112px', display: 'flex', flexDirection: 'column', gap: 34 }}>
        <span style={{ color: T3, fontSize: 13, lineHeight: '21px', maxWidth: 620 }}>
          スキルは<b style={{ color: T2 }}>必要なときだけ</b>読む手順書、ルールは<b style={{ color: T2 }}>毎回</b>効く制約です。
        </span>

        <Section label="この社員のスキル" right={<Add />}>
          {mine.map((s, i) => <Row key={s.id} name={s.name} file={s.file} on={s.on} last={i === mine.length - 1} />)}
        </Section>

        <Section label="会社ぜんぶのスキル" right={<Add />}>
          {shared.map((s, i) => <Row key={s.id} name={s.name} file={s.file} on={s.on} last={i === shared.length - 1} />)}
        </Section>

        {/* 点線のドロップ領域に .md / .zip を落として何個でも足せる */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 9, height: 116, borderRadius: 12, border: '1px dashed #262626',
        }}>
          <Icon name="upload" color={T4} size={18} />
          <span style={{ color: T4, fontSize: 12.5 }}>.md / .zip をここに落とす</span>
        </div>
      </div>
      <Composer placeholder="スキルを書いてもらう" />
    </Centre>
  );
}
