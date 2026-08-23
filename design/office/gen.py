import io, math, os

OUT = '/home/user/Ocean/design/office'
os.makedirs(OUT, exist_ok=True)

# ── OneFound の確定値（lib/design/tokens.ts / CLAUDE.md より） ──
BG, CARD, LINE, HAIR = '#000000', '#0E0E0E', '#232323', '#161616'
T1, T2, T3, T4, T5 = '#EDEDED', '#B8B8B8', '#8B8B8B', '#6E6E6E', '#5F5F5F'
DIM = '#3A3A3A'
BLUE, GREEN, AMBER, RED = '#1A73E8', '#1E8E3E', '#E37400', '#D93025'
BLUE_T, GREEN_T, AMBER_T, RED_T = '#669DF6', '#5BB974', '#FDD663', '#F28B82'
CYAN, PURPLE, INDIGO, AGREEN = '#2AA9BF', '#9A5CD0', '#5C6BC0', '#34A853'

W, H = 1180, 860

HEAD = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; background: %s; color: %s;
           font-family: system-ui, "Noto Sans JP", sans-serif; font-weight: 400;
           -webkit-font-smoothing: antialiased; }
    * { font-weight: 400; box-sizing: border-box; }
    a { color: inherit; }
    .tnum { font-variant-numeric: tabular-nums; }
    /* 並ぶものはヘアラインだけで区切る。外枠は付けない */
    .r { border-top: 1px solid %s; }
  </style>
</helmet>
''' % (BG, T1, HAIR)

TAIL = '''</x-dc>
</body>
</html>
'''

def board(title, tag, body, tagcolor=GREEN_T):
    return (HEAD + '<div style="width: %dpx; display: flex; flex-direction: column">'
            '<div style="padding: 24px 30px 18px; display: flex; align-items: baseline; gap: 12px">'
            '<span style="color: %s; font-size: 12px">%s</span>'
            '<span style="font-size: 20px">%s</span></div>'
            '<div style="height:1px;background:%s"></div>'
            % (W, tagcolor, tag, title, LINE)
            + body + '</div>' + TAIL)

# ══════════════════════ 部品 ══════════════════════

def dot(c, s=6):
    return '<span style="width:%dpx;height:%dpx;border-radius:9px;background:%s;flex-shrink:0"></span>' % (s, s, c)

def bar(pct, color=T4, w=90, h=3, track='#1A1A1A'):
    return ('<span style="display:inline-block;width:%dpx;height:%dpx;border-radius:2px;background:%s;overflow:hidden;flex-shrink:0">'
            '<span style="display:block;width:%s%%;height:100%%;border-radius:2px;background:%s"></span></span>'
            % (w, h, track, pct, color))

def orb(rgb, size=28, dim=False, glow=.9):
    a = .35 if dim else glow
    return ('<span style="width:%dpx;height:%dpx;border-radius:999px;flex-shrink:0;'
            'background:radial-gradient(circle at 40%% 35%%, rgba(%s,%s), rgba(%s,.14) 60%%, rgba(%s,0) 72%%)"></span>'
            % (size, size, rgb, a, rgb, rgb))

RGB = {'cyan': '42,169,191', 'purple': '154,92,208', 'indigo': '92,107,192',
       'green': '52,168,83', 'white': '210,210,210'}
HEX = {'cyan': CYAN, 'purple': PURPLE, 'indigo': INDIGO, 'green': AGREEN, 'white': '#D2D2D2'}

# ── データ（lib/dummy と同じ） ──
EMP = [
    ('調査担当', 'cyan',   '実行中', '競合ポジショニング分析', 74, '日本語学習サービス'),
    ('戦略担当', 'purple', '要確認', '収益モデル比較レポート', 41, '日本語学習サービス'),
    ('開発担当', 'green',  '実行中', '申込フォームの実装',     62, 'LPと申込フォーム'),
    ('企画担当', 'indigo', '実行中', '投稿カレンダー作成',     38, 'SNS運用の立ち上げ'),
]
WORKS = [
    ('SNS運用の立ち上げ',  38, '運用設計', 2, 3, '遅れ 2日',  RED_T,   'indigo', '8/27'),
    ('日本語学習サービス',  52, '戦略',     2, 4, '判断待ち',  AMBER_T, 'purple', '9/6'),
    ('LPと申込フォーム',    61, '制作',     2, 3, '順調',      T4,      'green',  '9/2'),
]
FEED = [
    ('09:41', '戦略担当', '収益モデル比較レポート を出しました', AMBER_T),
    ('09:38', '調査担当', '競合12件の価格を取り終えました',      T3),
    ('09:22', '統括AI',   'フェーズ2の関門「価格の方向性」を立てました', T3),
    ('09:05', '開発担当', '申込フォームのテストが通りました',    GREEN_T),
    ('08:52', '企画担当', '投稿カレンダー 1/4週ぶんを書きました', T3),
    ('08:31', '調査担当', '競合サイト1件が読めませんでした',      RED_T),
    ('08:20', '統括AI',   '調査フェーズを完了にしました',        GREEN_T),
]

# ══════════════════════ 診断（Main） ══════════════════════
def cell(t, sub):
    return ('<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">'
            '<span style="color:%s;font-size:13.5px;line-height:21px">%s</span>'
            '<span style="color:%s;font-size:11.5px;line-height:18px">%s</span></div>' % (T2, t, T5, sub))

main_body = ('<div style="padding: 22px 30px 30px; display:flex; flex-direction:column; gap:26px">'

  '<span style="color:%s;font-size:13.5px;line-height:22px;max-width:900px">'
  'いまのオフィスは<b style="color:%s">絵が1枚あるだけ</b>で、そこから読み取れるのは'
  '「誰がいるか」と「どの輪がどこまで来たか」の2つだけ。'
  '会社の状態を一目で知るには、見た人が輪を数えて、名前を探して、'
  'ほかの画面へ確かめに行くことになっていた。</span>' % (T2, T1) +

  # 参考から採るもの / 採らないもの
  '<div style="display:flex;gap:44px">'
    '<div style="flex:1;min-width:0">'
      '<span style="display:block;color:%s;font-size:11px;padding-bottom:10px">参考から採るもの</span>' % T5 +
      ''.join('<div class="r" style="display:flex;gap:12px;padding:11px 0">%s%s</div>'
              % (dot(GREEN, 5), cell(t, s)) for t, s in [
        ('中央に1つ、周りに読むもの', '主役の絵は残す。ただし絵の外に、名前・状態・出来事を置く'),
        ('出来事が流れている列', '「いま動いている」が、絵の点滅ではなく言葉で分かる'),
        ('1人1行の状態', '誰が何をどこまで、が縦に並ぶ。数えなくても分かる'),
        ('下段に会社ぜんぶの数', 'Work / タスク / 判断待ち が、視線を動かさずに読める'),
      ]) +
    '</div>'
    '<div style="flex:1;min-width:0">'
      '<span style="display:block;color:%s;font-size:11px;padding-bottom:10px">採らないもの（この製品では逆効果）</span>' % T5 +
      ''.join('<div class="r" style="display:flex;gap:12px;padding:11px 0">%s%s</div>'
              % (dot('#4A4A4A', 5), cell(t, s)) for t, s in [
        ('トークン・単価・CPU', 'ふだんの画面に出さないと決めてある。社長が動かせない数字'),
        ('全部を枠付きカードにする', '面と枠を持てるのは押せるものだけ。10個並べると模様になる'),
        ('虹色の凡例', '色は意味だけ。AI社員の色はオフィスと進捗にしか出さない'),
        ('稼働率・レイテンシ', '「進んでいるように見せる」数字。放っておけない数だけ出す'),
      ]) +
    '</div>'
  '</div>'

  '<div style="height:1px;background:%s"></div>' % HAIR +

  '<div>'
    '<span style="display:block;color:%s;font-size:11px;padding-bottom:10px">3案。'
    '<span style="color:%s">絵をどれだけ残すか</span>で分かれています</span>' % (T5, T3) +
    ''.join('<div class="r" style="display:flex;align-items:flex-start;gap:16px;padding:13px 0">'
            '<span style="width:104px;flex-shrink:0;color:%s;font-size:13px">%s</span>'
            '<span style="width:300px;flex-shrink:0;color:%s;font-size:13px;line-height:21px">%s</span>'
            '<span style="flex:1;min-width:0;color:%s;font-size:12.5px;line-height:20px">%s</span>'
            '<span style="width:190px;flex-shrink:0;color:%s;font-size:12px;line-height:20px">%s</span>'
            '</div>' % (T1, n, T2, what, T5, good, T4, bad)
      for n, what, good, bad in [
        ('A 計器盤', '絵は中央に小さく残し、左右と下に読むものを置く',
         '参考にいちばん近い。誰が・何を・どこまで・何が起きたか が一望できる',
         '引き換えに: 絵が小さくなる。1画面の要素が3倍になる'),
        ('B 濃い盤面', '絵1枚のまま。輪と社員に文字を足して、絵の上で読ませる',
         'いまの見た目を保ったまま情報量を上げる。板が増えない',
         '引き換えに: 文字が絵に乗るので、密度の上限が低い'),
        ('C 一気見の表', '絵をやめる。Work・社員・出来事を縦に積む',
         '「一気見」にいちばん忠実。数えなくていい。増えても崩れない',
         '引き換えに: この製品らしさ（軌道の絵）が既定の画面から消える'),
      ]) +
  '</div>'
  '</div>')

io.open(OUT + '/Main.dc.html', 'w', encoding='utf-8').write(
    board('いまのオフィスと、参考の距離', '診断', main_body, T3))
print('Main ok')

# ══════════════════════ 軌道の絵 ══════════════════════
def orbit(w, h, rings, emps, gate_ring=1, faint='#1C1C1C'):
    """rings: [(rx, ry, pct, color_key, dim)] / emps: [(ring_i, pct, key, dim)]"""
    cx, cy = w / 2, h / 2
    def at(rx, ry, pct):
        a = math.radians(-90 + 360 * pct / 100)
        return cx + rx * math.cos(a), cy + ry * math.sin(a)
    out = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="display:block">' % (w, h, w, h)]
    out.append('<defs><radialGradient id="ctr"><stop offset="0" stop-color="#D2D2D2" stop-opacity=".26"/>'
               '<stop offset="1" stop-color="#D2D2D2" stop-opacity="0"/></radialGradient></defs>')
    for i, (rx, ry, pct, key, dim) in enumerate(rings):
        out.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="none" stroke="%s" stroke-width="1"/>'
                   % (cx, cy, rx, ry, faint))
        if pct > 0:
            x1, y1 = at(rx, ry, pct)
            large = 1 if pct > 50 else 0
            out.append('<path d="M %.1f %.1f A %.1f %.1f 0 %d 1 %.1f %.1f" fill="none" stroke="%s" '
                       'stroke-width="2" stroke-linecap="round" opacity="%s"/>'
                       % (cx, cy - ry, rx, ry, large, x1, y1, '#8A8A8A' if not dim else '#4A4A4A', .95 if not dim else .5))
            # 弧の先端の印。判断待ちの Work だけ橙の菱形
            if i == gate_ring:
                out.append('<rect x="%.1f" y="%.1f" width="9" height="9" fill="%s" transform="rotate(45 %.1f %.1f)" rx="1.5"/>'
                           % (x1 - 4.5, y1 - 4.5, AMBER, x1, y1))
            else:
                out.append('<circle cx="%.1f" cy="%.1f" r="2.6" fill="#6E6E6E"/>' % (x1, y1))
    out.append('<circle cx="%.1f" cy="%.1f" r="54" fill="url(#ctr)"/>' % (cx, cy))
    out.append('<circle cx="%.1f" cy="%.1f" r="9" fill="#D2D2D2" opacity=".9"/>' % (cx, cy))
    for ri, pct, key, dim in emps:
        rx, ry = rings[ri][0], rings[ri][1]
        x, y = at(rx, ry, pct)
        c = HEX[key]
        out.append('<circle cx="%.1f" cy="%.1f" r="13" fill="%s" opacity="%s"/>' % (x, y, c, '.18' if not dim else '.08'))
        out.append('<circle cx="%.1f" cy="%.1f" r="5.5" fill="%s" opacity="%s"/>' % (x, y, c, '.95' if not dim else '.4'))
    out.append('</svg>')
    return ''.join(out), (cx, cy), at

def emp_row(name, key, state, now, pct, work, compact=False):
    col = {'実行中': (GREEN, GREEN_T), '要確認': (AMBER, AMBER_T), '待機': ('#4A4A4A', T4)}[state]
    return ('<div class="r" style="display:flex;align-items:center;gap:10px;padding:%s 0">'
            % ('9px' if compact else '11px')
            + orb(RGB[key], 24 if compact else 26, state == '待機')
            + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">'
              '<div style="display:flex;align-items:center;gap:7px">'
              '<span style="font-size:13px">%s</span>%s'
              '<span style="color:%s;font-size:11px">%s</span></div>'
              '<span style="color:%s;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">%s</span>'
              '</div>' % (name, dot(col[0], 5), col[1], state, T5, now)
            + bar(pct, HEX[key], 52, 3) + '</div>')

def feed_row(t, who, what, color, last=False):
    return ('<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;%s">'
            '<span style="color:%s;font-size:10.5px;width:34px;flex-shrink:0;padding-top:1px" class="tnum">%s</span>'
            '<span style="color:%s;font-size:11px;width:52px;flex-shrink:0;padding-top:1px">%s</span>'
            '<span style="flex:1;min-width:0;color:%s;font-size:11.5px;line-height:17px">%s</span></div>'
            % ('' if last else 'border-bottom:1px solid #131313', DIM, t, T5, who, color, what))

def work_row(title, pct, phase, pi, pn, health, hcol, key, due, last=False):
    return ('<div style="display:flex;align-items:center;gap:14px;padding:11px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + dot(HEX[key], 6)
            + '<span style="width:160px;flex-shrink:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">%s</span>' % title
            + bar(pct, HEX[key], 118, 4)
            + '<span style="width:34px;flex-shrink:0;color:%s;font-size:11.5px" class="tnum">%d%%</span>' % (T4, pct)
            + '<span style="width:156px;flex-shrink:0;color:%s;font-size:11.5px;white-space:nowrap">フェーズ %d / %d · %s</span>' % (T5, pi, pn, phase)
            + '<div style="flex:1"></div>'
            + '<span style="color:%s;font-size:11.5px;white-space:nowrap">%s</span>' % (hcol, health)
            + '<span style="width:44px;flex-shrink:0;text-align:right;color:%s;font-size:11.5px" class="tnum">%s</span>' % (DIM, due)
            + '</div>')

# ══════════════════════ A 計器盤 ══════════════════════
AW, AH = 540, 380
ACX, ACY = AW / 2, AH / 2
ARINGS = [(126, 74), (180, 106), (232, 137)]

def aat(rx, ry, pct):
    a = math.radians(-90 + 360 * pct / 100)
    return ACX + rx * math.cos(a), ACY + ry * math.sin(a)

def adeg(rx, ry, d):
    a = math.radians(d)
    return ACX + rx * math.cos(a), ACY + ry * math.sin(a)

svgA, _, _ = orbit(AW, AH,
    rings=[(126, 74, 52, 'purple', False), (180, 106, 38, 'indigo', False), (232, 137, 61, 'green', False)],
    emps=[(0, 74, 'cyan', False), (0, 41, 'purple', False), (1, 22, 'indigo', False), (2, 62, 'green', False)],
    gate_ring=0)

# 名前は輪の外側・左上。**輪へ伸びる短い線を必ず引く**（どの輪の名前か分からなくなる）
A_LABELS = [(0, 198, '日本語学習サービス', 'purple'),
            (1, 216, 'SNS運用の立ち上げ',  'indigo'),
            (2, 234, 'LPと申込フォーム',   'green')]
a_labels = ''
for ri, d, title, key in A_LABELS:
    x, y = adeg(ARINGS[ri][0], ARINGS[ri][1], d)
    a_labels += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-100%%,-50%%);'
                 'display:flex;align-items:center;gap:7px;white-space:nowrap">'
                 '%s<span style="color:%s;font-size:11px">%s</span>'
                 '<span style="width:9px;height:1px;background:#2E2E2E"></span></div>'
                 % (x + 1, y, dot(HEX[key], 5), T3, title))

a_body = ('<div style="padding:16px 30px 22px;display:flex;flex-direction:column;gap:12px">'
  # 答えの1行
  '<div style="display:flex;align-items:baseline;gap:12px">'
    '<span style="font-size:16px;line-height:26px">3つの Work のうち<b style="color:%s">1つが遅れています</b>。'
    '<b style="color:%s">判断待ちが 1件</b>、要確認が 1件。</span>'
    '<div style="flex:1"></div>'
    '<span style="color:%s;font-size:11.5px" class="tnum">稼働 4 / 4</span>'
  '</div>' % (RED_T, AMBER_T, T5) +

  '<div style="display:flex;gap:22px;align-items:stretch">'
    # 左: 社員のレール
    '<div style="width:238px;flex-shrink:0;display:flex;flex-direction:column">'
      '<span style="color:%s;font-size:11px;padding-bottom:4px">いま誰が何を</span>' % T5
      + emp_row('統括AI', 'white', '実行中', 'フェーズ2の関門を立てました', 100, '', True)
      + ''.join(emp_row(n, k, s_, now, p_, w, True) for n, k, s_, now, p_, w in EMP) +
      '<div style="flex:1"></div>'
      '<div class="r" style="display:flex;align-items:center;gap:10px;padding:10px 0 0;margin-top:10px">'
        '%s<span style="color:%s;font-size:11.5px">執筆担当 を採用しますか</span>'
        '<div style="flex:1"></div><span style="color:%s;font-size:11px">見る ›</span></div>'
        % (dot(DIM, 5), T4, T5) +
    '</div>'
    # 中: 絵
    '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">'
      '<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s%s</div>'
    '</div>' % (AW, AH, svgA, a_labels) +
    # 右: 出来事
    '<div style="width:288px;flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid %s;padding-left:20px">' % HAIR
      + '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
        '<span style="color:%s;font-size:11px">今日の出来事</span><div style="flex:1"></div>'
        '<span style="display:inline-flex;align-items:center;gap:6px;color:%s;font-size:10.5px">%s動いています</span></div>'
        % (T5, T5, dot(GREEN, 5))
      + ''.join(feed_row(t, w, x, c, i == len(FEED) - 1) for i, (t, w, x, c) in enumerate(FEED)) +
    '</div>'
  '</div>'

  # 下: Work の行
  '<div style="padding-top:6px">'
    '<span style="display:block;color:%s;font-size:11px;padding-bottom:2px">Work</span>' % T5
    + ''.join(work_row(*w, last=(i == len(WORKS) - 1)) for i, w in enumerate(WORKS)) +
  '</div>'
  '</div>')

io.open(OUT + '/OptionA.dc.html', 'w', encoding='utf-8').write(
    board('絵は中央に小さく。周りで読む', 'A 計器盤', a_body, BLUE_T))
print('A ok')

# ══════════════════════ B 濃い盤面 ══════════════════════
BW, BH = 1120, 560
BCX, BCY = BW / 2, BH / 2
BRINGS = [(200, 108), (292, 158), (382, 207)]

def bat(rx, ry, pct):
    a = math.radians(-90 + 360 * pct / 100)
    return BCX + rx * math.cos(a), BCY + ry * math.sin(a)

def bdeg(rx, ry, d):
    a = math.radians(d)
    return BCX + rx * math.cos(a), BCY + ry * math.sin(a)

svgB, _, _ = orbit(BW, BH,
    rings=[(200, 108, 52, 'purple', False), (292, 158, 38, 'indigo', False), (382, 207, 61, 'green', False)],
    emps=[], gate_ring=0)

# 輪の外側に、その Work の板をぶら下げる（右下の角を輪の上に置く）
B_LABELS = [
    (0, 198, '日本語学習サービス', 'purple', 52, 'フェーズ 2 / 4 · 戦略',   '判断待ち · 価格の方向性', AMBER_T),
    (1, 222, 'SNS運用の立ち上げ',  'indigo', 38, 'フェーズ 2 / 3 · 運用設計', '遅れ 2日 · 8/27',        RED_T),
    (2, 246, 'LPと申込フォーム',   'green',  61, 'フェーズ 2 / 3 · 制作',     '順調 · 9/2',             T4),
]
b_labels = ''
for ri, d, title, key, pct, phase, health, hcol in B_LABELS:
    x, y = bdeg(BRINGS[ri][0], BRINGS[ri][1], d)
    b_labels += (
      '<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-100%%,-100%%);'
      'text-align:right;white-space:nowrap">'
        '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">'
          '<span style="font-size:13.5px">%s</span>%s</div>'
        '<div style="display:flex;align-items:center;justify-content:flex-end;gap:9px;padding-top:6px">'
          '<span style="color:%s;font-size:11px">%s</span>%s'
          '<span style="color:%s;font-size:11.5px" class="tnum">%d%%</span></div>'
        '<div style="padding-top:5px"><span style="color:%s;font-size:11px">%s</span></div>'
      '</div>'
      '<div style="position:absolute;left:%.0fpx;top:%.0fpx;width:11px;height:1px;background:#2E2E2E"></div>'
      % (x - 14, y - 6, title, dot(HEX[key], 6), T5, phase, bar(pct, HEX[key], 76, 3), T4, pct, hcol, health, x - 13, y - 6))

# 社員は輪の上に立ち、名前の下に「いま何をしているか」を1行だけ持つ
B_EMPS = [
    (0, 74, '調査担当', 'cyan',   '競合ポジショニング分析',  GREEN),
    (0, 41, '戦略担当', 'purple', 'レポートを出しました',    AMBER),
    (1, 22, '企画担当', 'indigo', '投稿カレンダー 1/4週',    GREEN),
    (2, 62, '開発担当', 'green',  '申込フォームの実装',      GREEN),
]
b_emps = ''
for ri, pct, name, key, now, sc in B_EMPS:
    x, y = bat(BRINGS[ri][0], BRINGS[ri][1], pct)
    b_emps += (
      '<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
      'display:flex;flex-direction:column;align-items:center;gap:9px;white-space:nowrap">'
      '%s<div style="display:flex;flex-direction:column;align-items:center;gap:3px">'
      '<div style="display:flex;align-items:center;gap:6px"><span style="color:%s;font-size:12.5px">%s</span>%s</div>'
      '<span style="color:%s;font-size:11px">%s</span></div></div>'
      % (x, y, orb(RGB[key], 46), T2, name, dot(sc, 5), T5, now))

b_body = ('<div style="padding:14px 30px 20px;display:flex;flex-direction:column;gap:10px">'
  '<div style="display:flex;align-items:baseline;gap:12px">'
    '<span style="font-size:16px;line-height:26px">3つの Work のうち<b style="color:%s">1つが遅れています</b>。'
    '<b style="color:%s">判断待ちが 1件</b>、要確認が 1件。</span>'
    '<div style="flex:1"></div>'
    '<span style="color:%s;font-size:11.5px" class="tnum">稼働 4 / 4</span>'
  '</div>' % (RED_T, AMBER_T, T5) +

  '<div style="position:relative;width:%dpx;height:%dpx">%s%s%s'
  '<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
  'display:flex;flex-direction:column;align-items:center;gap:9px">'
  '%s<span style="color:#E8E8E8;font-size:13px">統括AI</span></div>'
  '</div>' % (BW, BH, svgB, b_labels, b_emps, BCX, BCY, orb(RGB['white'], 88, glow=.55)) +

  # 下の帯。絵の外に出さず、絵と地続きの1行として置く
  '<div style="display:flex;align-items:stretch;gap:0;padding-top:4px;border-top:1px solid %s">' % HAIR
  + ''.join('<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding:10px 18px 0;%s">'
            '<span style="color:%s;font-size:10.5px" class="tnum">%s</span>'
            '<span style="color:%s;font-size:11.5px;line-height:17px;overflow:hidden;text-overflow:ellipsis;'
            'white-space:nowrap">%s</span></div>'
            % ('' if i == 0 else 'border-left:1px solid %s' % HAIR, DIM, t, c, '%s が %s' % (who, what))
            for i, (t, who, what, c) in enumerate(FEED[:4]))
  + '<div style="display:flex;align-items:flex-end;padding:0 0 2px 18px">'
    '<span style="color:%s;font-size:11px">今日の出来事 ›</span></div>' % T5 +
  '</div>'
  '</div>')

io.open(OUT + '/OptionB.dc.html', 'w', encoding='utf-8').write(
    board('絵1枚のまま。輪と社員に文字を足す', 'B 濃い盤面', b_body, BLUE_T))
print('B ok')


# ══════════════════════ C 一気見の表 ══════════════════════
def gate_row(kind, kcol, what, work, last=False):
    """あなたが決める / 見る。**ここだけが面と枠を持つ**（押せるから）"""
    icon = ('<span style="width:9px;height:9px;background:%s;transform:rotate(45deg);border-radius:1.5px;'
            'flex-shrink:0"></span>' % AMBER) if kind == '判断待ち' else \
           ('<span style="width:10px;height:12px;border:1px solid %s;border-radius:2px;flex-shrink:0"></span>' % AMBER)
    return ('<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;%s">'
            % ('' if last else 'border-bottom:1px solid rgba(227,116,0,0.18)')
            + icon
            + '<span style="width:58px;flex-shrink:0;color:%s;font-size:11.5px">%s</span>' % (kcol, kind)
            + '<span style="font-size:13.5px">%s</span>' % what
            + '<div style="flex:1"></div>'
            + '<span style="color:%s;font-size:11.5px">%s</span>' % (T5, work)
            + '<span style="color:%s;font-size:12px;padding-left:14px">›</span>' % T4
            + '</div>')

def c_work_row(title, pct, phase, pi, pn, health, hcol, key, due, crew, last=False):
    orbs = ''.join('<span style="display:inline-flex;margin-left:%dpx">%s</span>' % (0 if i == 0 else -7, orb(RGB[k], 22))
                   for i, k in enumerate(crew))
    return ('<div style="display:flex;flex-direction:column;gap:9px;padding:24px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<div style="display:flex;align-items:center;gap:10px">'
              + dot(HEX[key], 6)
              + '<span style="font-size:14px">%s</span>' % title
              + '<div style="flex:1"></div>'
              + '<span style="color:%s;font-size:11.5px">%s</span>' % (hcol, health)
              + '<span style="width:42px;flex-shrink:0;text-align:right;color:%s;font-size:11.5px" class="tnum">%s</span>' % (DIM, due)
              + '</div>'
            + '<div style="display:flex;align-items:center;gap:11px">'
              + bar(pct, HEX[key], 208, 4)
              + '<span style="width:32px;flex-shrink:0;color:%s;font-size:11.5px" class="tnum">%d%%</span>' % (T4, pct)
              + '<span style="color:%s;font-size:11.5px">フェーズ %d / %d · %s</span>' % (T5, pi, pn, phase)
              + '<div style="flex:1"></div>'
              + '<div style="display:flex;align-items:center">%s</div>' % orbs
              + '</div>'
            + '</div>')

def c_emp_row(name, key, state, now, pct, work, last=False):
    sc = {'実行中': (GREEN, GREEN_T), '要確認': (AMBER, AMBER_T), '待機': ('#4A4A4A', T4)}[state]
    return ('<div style="display:flex;align-items:center;gap:12px;padding:12px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + orb(RGB[key], 30, state == '待機')
            + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">'
              '<div style="display:flex;align-items:center;gap:7px">'
              '<span style="font-size:13px">%s</span>%s<span style="color:%s;font-size:11px">%s</span></div>'
              '<span style="color:%s;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">%s</span>'
              '</div>' % (name, dot(sc[0], 5), sc[1], state, T5, now)
            + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">'
              + bar(pct, HEX[key], 62, 3)
              + '<span style="color:%s;font-size:10.5px">%s</span>' % (DIM, work)
              + '</div>'
            + '</div>')

C_CREW = {'SNS運用の立ち上げ': ['indigo'], '日本語学習サービス': ['purple', 'cyan'], 'LPと申込フォーム': ['green']}

c_body = ('<div style="padding:16px 30px 24px;display:flex;flex-direction:column;gap:22px">'
  '<div style="display:flex;align-items:baseline;gap:12px">'
    '<span style="font-size:16px;line-height:26px">3つの Work のうち<b style="color:%s">1つが遅れています</b>。'
    '<b style="color:%s">判断待ちが 1件</b>、要確認が 1件。</span>'
    '<div style="flex:1"></div>'
    '<span style="color:%s;font-size:11.5px" class="tnum">稼働 4 / 4</span>'
  '</div>' % (RED_T, AMBER_T, T5) +

  # あなたの番。**この画面でここだけが面と枠を持つ**
  '<div style="border:1px solid rgba(227,116,0,0.30);border-radius:12px;background:rgba(227,116,0,0.055)">'
  + gate_row('判断待ち', AMBER_T, '価格の方向性を決める', '日本語学習サービス')
  + gate_row('要確認', AMBER_T, '収益モデル比較レポート を見る', '日本語学習サービス', last=True)
  + '</div>' +

  '<div style="display:flex;gap:44px;align-items:flex-start">'
    '<div style="flex:1.22;min-width:0">'
      '<span style="display:block;color:%s;font-size:11px;padding-bottom:2px">Work</span>' % T5
      + ''.join(c_work_row(t, p, ph, pi, pn, h, hc, k, d, C_CREW[t], last=(i == len(WORKS) - 1))
                for i, (t, p, ph, pi, pn, h, hc, k, d) in enumerate(WORKS)) +
    '</div>'
    '<div style="flex:1;min-width:0">'
      '<span style="display:block;color:%s;font-size:11px;padding-bottom:2px">AI社員</span>' % T5
      + c_emp_row('統括AI', 'white', '実行中', 'フェーズ2の関門を立てました', 100, '会社ぜんぶ')
      + ''.join(c_emp_row(n, k, s, now, p, w, last=(i == len(EMP) - 1))
                for i, (n, k, s, now, p, w) in enumerate(EMP)) +
    '</div>'
  '</div>'

  '<div>'
    '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
      '<span style="color:%s;font-size:11px">今日の出来事</span><div style="flex:1"></div>'
      '<span style="display:inline-flex;align-items:center;gap:6px;color:%s;font-size:10.5px">%s動いています</span></div>'
      % (T5, T5, dot(GREEN, 5)) +
    '<div style="display:flex;gap:44px">'
      + ''.join('<div style="flex:1;min-width:0">%s</div>'
                % ''.join(feed_row(t, w, x, c, j == 3) for j, (t, w, x, c) in enumerate(col))
                for col in [FEED[:4], FEED[3:7]]) +
    '</div>'
  '</div>'
  '</div>')

io.open(OUT + '/OptionC.dc.html', 'w', encoding='utf-8').write(
    board('絵をやめる。数えずに読める形に', 'C 一気見の表', c_body, BLUE_T))
print('C ok')

# ══════════════════════ canvas.json ══════════════════════
import json
canvas = {
  "artboards": [
    {"file": "Main.dc.html",    "x": 0,    "y": 0, "w": 1180, "h": 770, "title": "診断"},
    {"file": "OptionA.dc.html", "x": 1300, "y": 0, "w": 1180, "h": 730, "title": "A 計器盤"},
    {"file": "OptionB.dc.html", "x": 2600, "y": 0, "w": 1180, "h": 780, "title": "B 濃い盤面"},
    {"file": "OptionC.dc.html", "x": 3900, "y": 0, "w": 1180, "h": 800, "title": "C 一気見の表"},
  ],
  "launch": {"view": "canvas"},
}
io.open(OUT + '/canvas.json', 'w', encoding='utf-8').write(json.dumps(canvas, ensure_ascii=False, indent=2))
print('canvas ok')
