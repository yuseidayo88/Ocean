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
    /* スクロールの棒は細く。色は増やさない */
    .sy, .sx { scrollbar-width: thin; scrollbar-color: #2A2A2A transparent; }
    .sy { overflow-y: auto; overflow-x: hidden; }
    .sx { overflow-x: auto; overflow-y: hidden; }
    .sy::-webkit-scrollbar, .sx::-webkit-scrollbar { width: 6px; height: 6px; }
    .sy::-webkit-scrollbar-track, .sx::-webkit-scrollbar-track { background: transparent; }
    .sy::-webkit-scrollbar-thumb, .sx::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 3px; }
  </style>
</helmet>
''' % (BG, T1, HAIR)

TAIL = '''</x-dc>
</body>
</html>
'''

def board(title, tag, body, tagcolor=GREEN_T, note=''):
    return (HEAD + '<div style="width: %dpx; display: flex; flex-direction: column">'
            '<div style="padding: 24px 30px 18px; display: flex; align-items: baseline; gap: 12px">'
            '<span style="color: %s; font-size: 12px">%s</span>'
            '<span style="font-size: 20px">%s</span>'
            '<div style="flex:1"></div>'
            '<span style="color:%s;font-size:11.5px">%s</span></div>'
            '<div style="height:1px;background:%s"></div>'
            % (W, tagcolor, tag, title, T5, note, LINE)
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

# ══════════════════════ 各AI社員に「マシン」を持たせる ══════════════════════
MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

def rnd(seed, n):
    """決め打ちの揺らぎ（毎回同じ絵になる）"""
    v, x = [], seed
    for _ in range(n):
        x = (x * 1103515245 + 12345) % 2147483648
        v.append(((x >> 13) % 1000) / 1000)
    return v

def spark(seed, color, n=26, h=18, dim=False):
    """細い縦棒の折れ線。**動いていない社員は平ら**にする（嘘の脈を打たせない）"""
    v = rnd(seed, n)
    bars = ''
    for i, u in enumerate(v):
        hh = 2 if dim else max(2, round(3 + u * (h - 4)))
        o = .3 if dim else (.34 + .55 * u)
        bars += ('<span style="width:2px;height:%dpx;border-radius:1px;background:%s;opacity:%.2f"></span>'
                 % (hh, color, o))
    return ('<span style="display:inline-flex;align-items:flex-end;gap:1px;height:%dpx;flex-shrink:0">%s</span>'
            % (h, bars))

def mono(t, c=DIM, size=10.5):
    return '<span style="font-family:%s;font-size:%spx;color:%s;white-space:nowrap">%s</span>' % (MONO, size, c, t)

def steps(done, now, total, color, w=104):
    """工程の行を1本に畳む。済＝暗い面 / いま＝明るい面 / これから＝点線（進捗の読み方と同じ）"""
    cw = (w - (total - 1) * 3) / total
    out = ''
    for i in range(total):
        if i < done:
            st = 'background:%s;opacity:.45' % color
        elif i == done and now:
            st = 'background:%s' % color
        else:
            st = 'background:#191919'
        out += '<span style="width:%.1fpx;height:4px;border-radius:2px;%s"></span>' % (cw, st)
    return '<span style="display:inline-flex;gap:3px;flex-shrink:0">%s</span>' % out

STATE_C = {'実行中': (GREEN, GREEN_T), '要確認': (AMBER, AMBER_T), '待機': ('#4A4A4A', T4)}

def a_frame(rail, orbit_html, feed_w=260, orbit_w=460):
    """A の骨格。左＝社員 / 中＝絵 / 右＝今日の出来事 / 下＝Work"""
    return ('<div style="padding:16px 30px 22px;display:flex;flex-direction:column;gap:12px">'
      '<div style="display:flex;align-items:baseline;gap:12px">'
        '<span style="font-size:16px;line-height:26px">3つの Work のうち<b style="color:%s">1つが遅れています</b>。'
        '<b style="color:%s">判断待ちが 1件</b>、要確認が 1件。</span>'
        '<div style="flex:1"></div>'
        '<span style="color:%s;font-size:11.5px" class="tnum">稼働 4 / 4</span>'
      '</div>' % (RED_T, AMBER_T, T5)
      + '<div style="display:flex;gap:22px;align-items:stretch">'
      + rail
      + '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">%s</div>' % orbit_html
      + '<div style="width:%dpx;flex-shrink:0;display:flex;flex-direction:column;'
        'border-left:1px solid %s;padding-left:20px">' % (feed_w, HAIR)
        + '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
          '<span style="color:%s;font-size:11px">今日の出来事</span><div style="flex:1"></div>'
          '<span style="display:inline-flex;align-items:center;gap:6px;color:%s;font-size:10.5px">%s動いています</span></div>'
          % (T5, T5, dot(GREEN, 5))
        + ''.join(feed_row(t, w, x, c, i == len(FEED) - 1) for i, (t, w, x, c) in enumerate(FEED))
      + '</div></div>'
      + '<div style="padding-top:6px">'
        '<span style="display:block;color:%s;font-size:11px;padding-bottom:2px">Work</span>' % T5
        + ''.join(work_row(*w, last=(i == len(WORKS) - 1)) for i, w in enumerate(WORKS))
      + '</div></div>')

# 絵は A と同じ読み方のまま、レールに場所を譲って小さくする
OW2, OH2 = 460, 380
OCX, OCY = OW2 / 2, OH2 / 2
ORINGS = [(105, 66), (150, 95), (195, 124)]
svg2, _, _ = orbit(OW2, OH2,
    rings=[(105, 66, 52, 'purple', False), (150, 95, 38, 'indigo', False), (195, 124, 61, 'green', False)],
    emps=[(0, 74, 'cyan', False), (0, 41, 'purple', False), (1, 22, 'indigo', False), (2, 62, 'green', False)],
    gate_ring=0)
lab2 = ''
for ri, d, title, key in [(0, 198, '日本語学習サービス', 'purple'),
                          (1, 216, 'SNS運用の立ち上げ',  'indigo'),
                          (2, 234, 'LPと申込フォーム',   'green')]:
    a = math.radians(d)
    x, y = OCX + ORINGS[ri][0] * math.cos(a), OCY + ORINGS[ri][1] * math.sin(a)
    lab2 += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-100%%,-50%%);'
             'display:flex;align-items:center;gap:7px;white-space:nowrap">'
             '%s<span style="color:%s;font-size:11px">%s</span>'
             '<span style="width:9px;height:1px;background:#2E2E2E"></span></div>'
             % (x + 1, y, dot(HEX[key], 5), T3, title))
ORBIT2 = ('<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s%s</div>'
          % (OW2, OH2, svg2, lab2))

# ══════════════════════ A1 実機（頼まれたとおり） ══════════════════════
MACHINE = [
    ('統括AI',   'white',  '実行中', 'フェーズ2の関門を立てました',   'exec-00',       34, 96, '0.9s', '1.8 GB', 11),
    ('調査担当', 'cyan',   '実行中', '競合ポジショニング分析',        'vm-research-01', 71, 82, '1.4s', '3.2 GB', 23),
    ('戦略担当', 'purple', '要確認', '収益モデル比較レポート',        'vm-strategy-02', 12, 44, '2.1s', '1.1 GB', 31),
    ('開発担当', 'green',  '実行中', '申込フォームの実装',            'vm-build-03',    88, 91, '1.1s', '4.6 GB', 47),
    ('企画担当', 'indigo', '実行中', '投稿カレンダー作成',            'vm-plan-04',     46, 63, '1.7s', '2.4 GB', 59),
]

def m_strip(name, key, state, now, host, cpu, up, lat, mem, seed, last=False):
    sc = STATE_C[state]
    hot = RED_T if cpu >= 85 else (T2 if cpu >= 40 else T4)
    return ('<div style="display:flex;flex-direction:column;gap:7px;padding:12px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<div style="display:flex;align-items:center;gap:9px">'
              + orb(RGB[key], 24, state == '待機')
              + '<span style="font-size:13px">%s</span>' % name + dot(sc[0], 5)
              + '<span style="color:%s;font-size:11px">%s</span>' % (sc[1], state)
              + '<div style="flex:1"></div>' + mono(host)
            + '</div>'
            + '<div style="padding-left:33px;display:flex;flex-direction:column;gap:6px">'
              + '<span style="color:%s;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;'
                'white-space:nowrap">%s</span>' % (T5, now)
              + '<div style="display:flex;align-items:center;gap:8px">'
                + mono('CPU', T5) + bar(cpu, HEX[key], 62, 4)
                + '<span style="width:30px;color:%s;font-size:11px" class="tnum">%d%%</span>' % (hot, cpu)
                + spark(seed, HEX[key], 26, 16, state == '待機')
              + '</div>'
              + mono('稼働 %d%%  ·  応答 %s  ·  メモリ %s' % (up, lat, mem))
            + '</div></div>')

rail_a1 = ('<div style="width:300px;flex-shrink:0;display:flex;flex-direction:column">'
  '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
  '<span style="color:%s;font-size:11px">マシン</span><div style="flex:1"></div>'
  '<span style="color:%s;font-size:10.5px">5台</span></div>' % (T5, T5)
  + ''.join(m_strip(*m, last=(i == len(MACHINE) - 1)) for i, m in enumerate(MACHINE))
  + '</div>')

io.open(OUT + '/OptionA1.dc.html', 'w', encoding='utf-8').write(
    board('CPU・稼働率・応答をそのまま出す', 'A1 実機', a_frame(rail_a1, ORBIT2), AMBER_T))
print('A1 ok')

# ══════════════════════ A2 正直な計器 ══════════════════════
# 見た目の密度は A1 と同じ。**出ている数が全部ほんとうの数**なところだけ違う
REAL = [
    ('統括AI',   'white',  '実行中', 'Opus 5 · 深さ 5',   'フェーズ2の関門を立てる',  '',      3, True, 4,
     '判断 3件  ·  提案 2件  ·  今日 5時間02分'),
    ('調査担当', 'cyan',   '実行中', 'Sonnet 5 · 深さ 4', '競合ポジショニング分析',   '4:12',  3, True, 5,
     'web検索 12  ·  取得 34  ·  書き出し 3  ·  今日 3時間12分'),
    ('戦略担当', 'purple', '要確認', 'Opus 5 · 深さ 5',   '収益モデル比較レポート',   '',      5, False, 5,
     '読んだ資料 18  ·  書き出し 1  ·  今日 2時間41分'),
    ('開発担当', 'green',  '実行中', 'Sonnet 5 · 深さ 3', '申込フォームの実装',       '11:38', 2, True, 4,
     'ファイル 9  ·  テスト 24  ·  今日 4時間05分'),
    ('企画担当', 'indigo', '実行中', 'Haiku 4.5 · 深さ 2', '投稿カレンダー作成',      '1:56',  1, True, 3,
     '書き出し 4  ·  今日 1時間20分'),
]
STEPNAME = {'統括AI': '関門を立てる', '調査担当': 'ページ取得', '戦略担当': '完了',
            '開発担当': 'テスト', '企画担当': '下書き'}

def r_strip(name, key, state, spec, now, el, done, running, total, log, last=False):
    sc = STATE_C[state]
    return ('<div style="display:flex;flex-direction:column;gap:7px;padding:12px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<div style="display:flex;align-items:center;gap:9px">'
              + orb(RGB[key], 24, state == '待機')
              + '<span style="font-size:13px">%s</span>' % name + dot(sc[0], 5)
              + '<span style="color:%s;font-size:11px">%s</span>' % (sc[1], state)
              + '<div style="flex:1"></div>'
              + '<span style="color:%s;font-size:10.5px;white-space:nowrap">%s</span>' % (T5, spec)
            + '</div>'
            + '<div style="padding-left:33px;display:flex;flex-direction:column;gap:6px">'
              + '<div style="display:flex;align-items:baseline;gap:8px">'
                + '<span style="color:%s;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;'
                  'white-space:nowrap">%s</span><div style="flex:1"></div>%s' % (T2, now, mono(el, T5) if el else '')
              + '</div>'
              + '<div style="display:flex;align-items:center;gap:9px">'
                + steps(done, running, total, HEX[key], 104)
                + '<span style="color:%s;font-size:11px">%d / %d · %s</span>' % (T5, done, total, STEPNAME[name])
              + '</div>'
              + mono(log)
            + '</div></div>')

rail_a2 = ('<div style="width:300px;flex-shrink:0;display:flex;flex-direction:column">'
  '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
  '<span style="color:%s;font-size:11px">いま誰が何を</span><div style="flex:1"></div>'
  '<span style="color:%s;font-size:10.5px">5人</span></div>' % (T5, T5)
  + ''.join(r_strip(*m, last=(i == len(REAL) - 1)) for i, m in enumerate(REAL))
  + '</div>')

io.open(OUT + '/OptionA2.dc.html', 'w', encoding='utf-8').write(
    board('同じ密度のまま、全部ほんとうの数にする', 'A2 正直な計器', a_frame(rail_a2, ORBIT2), BLUE_T))
print('A2 ok')

# ══════════════════════ その数字はどこから来るか ══════════════════════
def num_row(metric, has, hcol, why, alt, last=False):
    return ('<div style="display:flex;align-items:flex-start;gap:16px;padding:12px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<span style="width:118px;flex-shrink:0;font-size:13px">%s</span>' % metric
            + '<span style="width:78px;flex-shrink:0;color:%s;font-size:12px">%s</span>' % (hcol, has)
            + '<span style="width:352px;flex-shrink:0;color:%s;font-size:12px;line-height:20px">%s</span>' % (T5, why)
            + '<span style="flex:1;min-width:0;color:%s;font-size:12.5px;line-height:20px">%s</span>' % (T2, alt)
            + '</div>')

num_body = ('<div style="padding:22px 30px 30px;display:flex;flex-direction:column;gap:24px">'
  '<span style="color:%s;font-size:13.5px;line-height:22px;max-width:940px">'
  'AI社員は<b style="color:%s">たしかに1人1台のマシンで動いています</b>'
  '（サンドボックスが1人に1つ。ap-northeast-1）。'
  'なので「マシンを持たせる」という方向そのものは合っています。'
  '問題は<b style="color:%s">どの計器を出すか</b>だけです。</span>' % (T2, T1, T1) +

  '<div>'
    '<div style="display:flex;gap:16px;padding-bottom:8px">'
      '<span style="width:118px;flex-shrink:0;color:%s;font-size:11px">参考にあった計器</span>'
      '<span style="width:78px;flex-shrink:0;color:%s;font-size:11px">実データ</span>'
      '<span style="width:352px;flex-shrink:0;color:%s;font-size:11px">なぜ</span>'
      '<span style="flex:1;color:%s;font-size:11px">代わりに出せる、ほんとうの数</span>'
    '</div>' % (T5, T5, T5, T5)
    + num_row('CPU 使用率', 'ない', RED_T,
              'AI社員がやっているのは LLM の呼び出しと道具の実行。'
              '走っているのは Workers と外部API で、CPU という単位が存在しない',
              'いまどの工程にいるか（run_steps を1本に畳んだ帯）')
    + num_row('メモリ', 'ない', RED_T,
              '同じ。GB という数え方をしていない',
              '読んだ資料の件数 · 書き出した件数')
    + num_row('レイテンシ', 'ある', GREEN_T,
              '1往復の秒数は記録している。ただし社長はこれを見ても何もできない。'
              '遅ければ待つし、止まればエラーで分かる',
              '経過時間（このタスクを何分やっているか）')
    + num_row('稼働率', 'ある', GREEN_T,
              '「今日このAI社員が動いていた時間」なら出せる。'
              'ただし％にすると「上げるべき数字」に見えてしまう',
              '今日 3時間12分 · タスク 7件（時間そのもので言う）')
    + num_row('スループット', 'ない', RED_T,
              '1人が同時に1タスクしか持たない設計なので、req/s に意味がない',
              '待ち 2件（このあと何が積まれているか）')
    + num_row('トークン · 単価', 'ある', AMBER_T,
              '本当にあるが、ふだんの画面に出さないと決めてある'
              '（→ CLAUDE.md「トークンはふだんの画面に出さない」）',
              '請求とプランの画面 · 枠に当たって止まったときだけ', last=True)
  + '</div>'

  '<div style="height:1px;background:%s"></div>' % HAIR +

  '<div style="display:flex;gap:44px">'
    '<div style="flex:1">'
      '<span style="display:block;color:%s;font-size:11px;padding-bottom:10px">A1 を選ぶとどうなるか</span>' % T5
      + ''.join('<div class="r" style="display:flex;gap:12px;padding:11px 0">%s%s</div>' % (dot('#4A4A4A', 5), cell(t, x))
        for t, x in [
          ('計器が6つのうち3つ作り話になる', 'CPU・メモリ・スループットは値を発明することになる'),
          ('作り話は1つでも隣に移る', '同じ帯の「稼働 82%」まで疑われる。計器盤の値打ちは全部本当なところにしかない'),
          ('直せなくなる', '本物の実装が来たときに CPU だけ出せない。'
                          'その1マスを消すと帯のデザインが崩れる'),
        ]) +
    '</div>'
    '<div style="flex:1">'
      '<span style="display:block;color:%s;font-size:11px;padding-bottom:10px">A2 で失うもの・得るもの</span>' % T5
      + ''.join('<div class="r" style="display:flex;gap:12px;padding:11px 0">%s%s</div>' % (dot(GREEN, 5), cell(t, x))
        for t, x in [
          ('見た目の密度は同じ', '1人4行・スパークラインの代わりに工程の帯。参考の「生きている感じ」は工程の帯が動いて出す'),
          ('全部いま記録している数', 'run_steps / 経過 / モデルと深さ / 道具の使用回数 / 今日の稼働時間'),
          ('社長が動かせる', '「開発担当が11分テストで止まっている」は読んだ人が何かできる。「CPU 88%」は何もできない'),
        ]) +
    '</div>'
  '</div>'
  '</div>')

io.open(OUT + '/Numbers.dc.html', 'w', encoding='utf-8').write(
    board('その数字はどこから来るか', '検討', num_body, T3))
print('Numbers ok')

# ══════════════════════ 参考の計器を1つずつ ══════════════════════
SRC = {1: '①', 2: '②', 3: '③', 4: '④'}

def p_row(param, src, real, where, verdict, vcol, last=False):
    return ('<div style="display:flex;align-items:flex-start;gap:14px;padding:11px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<span style="width:158px;flex-shrink:0;font-size:12.5px;line-height:19px">%s</span>' % param
            + '<span style="width:34px;flex-shrink:0;color:%s;font-size:11px">%s</span>'
              % (DIM, ''.join(SRC[x] for x in src))
            + '<span style="width:300px;flex-shrink:0;color:%s;font-size:12.5px;line-height:19px">%s</span>' % (T2, real)
            + '<span style="flex:1;min-width:0;color:%s;font-size:12px;line-height:19px">%s</span>' % (T5, where)
            + '<span style="width:96px;flex-shrink:0;text-align:right;color:%s;font-size:11.5px">%s</span>' % (vcol, verdict)
            + '</div>')

def p_head(t, n, c):
    return ('<div style="display:flex;align-items:baseline;gap:9px;padding-bottom:6px">'
            '%s<span style="color:%s;font-size:12.5px">%s</span>'
            '<span style="color:%s;font-size:11px" class="tnum">%d</span></div>' % (dot(c, 5), T2, t, T5, n))

TAKE = [
  ('承認の台帳<br><span style="color:#5F5F5F;font-size:11px">APPROVALS-GATE</span>', [1, 2],
   'きょうの決定を「AIが決めた / あなたに聞いた」で分ける。decisions に出どころが入っている',
   '答えの1行の右。憲法の「社長を飛ばさない」を、画面で証明する数字になる'),
  ('社員ごとに違う計器<br><span style="color:#5F5F5F;font-size:11px">TRACKER / FIT / FUEL のカード</span>', [3],
   'すでに決めてある「中身の器は担当ではなく produces で決める」と同じ。'
   '調査＝積まれた事実 / 執筆＝伸びる文章 / 実装＝テストの目盛り',
   '社員のレール。全員同じバーをやめると、レールを見るだけで職種が分かる'),
  ('待ち<br><span style="color:#5F5F5F;font-size:11px">QUEUE DEPTH</span>', [1],
   'そのAI社員のあとに積まれているタスク数。tasks の queued を数えるだけ',
   '社員の行の右。「多いな、もう1人採用するか」に直結する'),
  ('工程と経過<br><span style="color:#5F5F5F;font-size:11px">INTAKE / SPLIT / TOOL CALL</span>', [2, 4],
   'run_steps。いまどの工程にいるか＋このタスクを何分やっているか',
   'A2 で入れた工程の帯。参考の「生きている感じ」はここが動いて出す'),
  ('実際に動いた線だけ描く<br><span style="color:#5F5F5F;font-size:11px">EVERY LINE IS A MESSAGE THAT ACTUALLY MOVED</span>', [2],
   '受け渡しが起きたときだけ、絵の粒を流す。演出で常時流さない',
   '絵の原則。いまも粒は流れているが、この規則を明文化する'),
  ('モデルと経路<br><span style="color:#5F5F5F;font-size:11px">ROUTE grok-4 / grok-4-fast</span>', [1, 2],
   'そのAI社員のモデルと思考の深さ。すでに設定として持っている',
   '社員の行の右。A2 で入れた `Sonnet 5 · 深さ 4`'),
  ('出来事の列<br><span style="color:#5F5F5F;font-size:11px">LIVE FEED</span>', [1, 3, 4],
   '時刻 · 誰 · 何をした。runs と run_steps から出る',
   'A にもう入っている。ok / retry の右端ラベルは足さない（状態の6語の外）'),
]

MOVE = [
  ('引き継ぎのスイムレーン<br><span style="color:#5F5F5F;font-size:11px">THE TRACE</span>', [2],
   '誰がこのタスクを持っていて、誰に渡したか。run_steps に担当が入っている',
   'Work の画面へ。オフィスは会社ぜんぶを見る場所なので、1つの Work の内訳は入らない'),
  ('やり直しの内訳<br><span style="color:#5F5F5F;font-size:11px">RETRY LEDGER</span>', [2],
   'タイムアウト / 形が合わない / 上限に当たった / 空が返った。全部いま記録している',
   '通知（エラー）の中へ。ふだんは出さない。止まったときだけ理由を1行'),
  ('手戻りの回数<br><span style="color:#5F5F5F;font-size:11px">HOPS PER JOB · 2.4</span>', [2],
   '同じ成果物を何回書き直したか',
   'Work の画面へ。「深さを上げますか」の判断材料になるが、ホームでは細かすぎる'),
  ('毎回読む手順書<br><span style="color:#5F5F5F;font-size:11px">AGENTS.md · READ ON EVERY ASSIGN</span>', [2],
   'SKILL.md とルール。employee_skills に有効・無効がある',
   '社員の設定ペインへ。「このタスクで読んだスキル」を実行のたびに出せる'),
  ('人を雇った場合との差<br><span style="color:#5F5F5F;font-size:11px">SAVED VS THE OLD SEAT</span>', [2],
   '使った額と、人を雇ったらいくらだったか。一人社長にはいちばん効く数字',
   '請求とプランの画面へ。ふだんの画面には出さないと決めてある'),
]

DROP = [
  ('CPU · メモリ · I/O · ネットワーク', [4],
   'ない。LLM の呼び出しと道具の実行で、CPU という単位が存在しない',
   '出すなら値を発明することになる。作り話は隣の本当の数まで疑わせる'),
  ('P95 · レイテンシ · スループット', [1, 2],
   '秒数はあるが、1人が同時に1タスクしか持たない設計',
   '社長が見ても何もできない。遅ければ待つし、止まればエラーで分かる'),
  ('トークン / 分 · 使った額', [1, 2],
   'ある',
   '請求とプランの画面だけ。枠に当たって止まったときは別途出す'),
  ('稼働率 ％', [1, 4],
   '「今日動いていた時間」なら出せる',
   '％にすると「上げるべき数字」に見える。時間そのもので言う'),
  ('人ごとのスコア環<br><span style="color:#5F5F5F;font-size:11px">DAD 82 recovery</span>', [3],
   'ない。AI社員に「調子」という指標が無い',
   '作れば必ず作り話になる'),
  ('ドーナツ＋凡例', [4],
   'フェーズ別のタスク数ならある',
   '凡例が要るなら形のほうが間違っている。Work の帯でもう言えている'),
]

par_body = ('<div style="padding:22px 30px 30px;display:flex;flex-direction:column;gap:26px">'
  '<span style="color:%s;font-size:13.5px;line-height:22px;max-width:960px">'
  '4枚に出ていた計器を1つずつ見ました。'
  '<b style="color:%s">7つはそのまま採れます</b>。'
  '5つは本物だけど<b style="color:%s">置き場所がホームではない</b>。'
  '6つは値を発明することになるので採りません。</span>' % (T2, T1, T1) +

  '<div>' + p_head('そのまま採る', len(TAKE), GREEN)
    + '<div style="display:flex;gap:14px;padding-bottom:6px">'
      '<span style="width:158px;flex-shrink:0;color:%s;font-size:10.5px">参考の計器</span>'
      '<span style="width:34px;flex-shrink:0;color:%s;font-size:10.5px">出典</span>'
      '<span style="width:300px;flex-shrink:0;color:%s;font-size:10.5px">OneFound での正体</span>'
      '<span style="flex:1;color:%s;font-size:10.5px">どこに置くか</span>'
      '<span style="width:96px;flex-shrink:0;"></span></div>' % (T5, T5, T5, T5)
    + ''.join(p_row(a, b, c, d, 'A3 に入れた', GREEN_T, last=(i == len(TAKE) - 1))
              for i, (a, b, c, d) in enumerate(TAKE))
  + '</div>'

  '<div>' + p_head('本物だが、ホームではない', len(MOVE), AMBER)
    + ''.join(p_row(a, b, c, d, e, AMBER_T, last=(i == len(MOVE) - 1))
              for i, ((a, b, c, d), e) in enumerate(zip(MOVE,
                ['Work の画面', '通知（エラー）', 'Work の画面', '社員の設定', '請求とプラン'])))
  + '</div>'

  '<div>' + p_head('採らない', len(DROP), '#4A4A4A')
    + ''.join(p_row(a, b, c, d, '採らない', T4, last=(i == len(DROP) - 1))
              for i, (a, b, c, d) in enumerate(DROP))
  + '</div>'

  '<div style="height:1px;background:%s"></div>' % HAIR +
  '<span style="color:%s;font-size:12px;line-height:20px;max-width:960px">'
  '出典 ① GROK BOT SYSTEM　② GROK AGENT SYSTEM　③ ScottyBeamIO　④ LIVE AGENT WORKSPACE'
  '</span>' % T5 +
  '</div>')

io.open(OUT + '/Params.dc.html', 'w', encoding='utf-8').write(
    board('4枚の計器を1つずつ', '採用の可否', par_body, T3))
print('Params ok')

# ══════════════════════ A3 = A2 ＋ 採ったもの ══════════════════════
def sq_run(n, filled, color, size=5, gap=2):
    out = ''
    for i in range(n):
        o = '.85' if i < filled else '.16'
        out += '<span style="width:%dpx;height:%dpx;border-radius:1px;background:%s;opacity:%s"></span>' % (size, size, color, o)
    return '<span style="display:inline-flex;gap:%dpx;flex-shrink:0">%s</span>' % (gap, out)

def dot_run(n, ok, color, bad=0):
    out = ''
    for i in range(n):
        c = RED if i >= n - bad else color
        out += '<span style="width:3px;height:3px;border-radius:3px;background:%s;opacity:%s"></span>' % (
            c, '.9' if i < ok or i >= n - bad else '.16')
    return '<span style="display:inline-flex;gap:2px;flex-shrink:0">%s</span>' % out

def text_lines(color, ws=(46, 38, 26)):
    out = ''.join('<span style="width:%dpx;height:2px;border-radius:1px;background:%s;opacity:%s"></span>'
                  % (w, color, ['.75', '.55', '.35'][i]) for i, w in enumerate(ws))
    return ('<span style="display:inline-flex;flex-direction:column;gap:3px;flex-shrink:0">%s</span>' % out)

def week_cells(n, done, color):
    out = ''.join('<span style="width:15px;height:7px;border-radius:2px;background:%s;opacity:%s"></span>'
                  % (color, '.85' if i < done else '.14') for i in range(n))
    return '<span style="display:inline-flex;gap:3px;flex-shrink:0">%s</span>' % out

# **中身の器は担当ではなく produces で決める**（③ ScottyBeamIO から採った形）
PRODUCE = {
    '統括AI':  lambda: (mono('決めた 12  ·  聞いた 2', T5), ''),
    '調査担当': lambda: (sq_run(16, 11, CYAN),   '事実 34'),
    '戦略担当': lambda: (text_lines(PURPLE),      '1,240字'),
    '開発担当': lambda: (dot_run(24, 24, AGREEN), 'テスト 24 / 24'),
    '企画担当': lambda: (week_cells(4, 1, INDIGO), '1 / 4週'),
}
WAIT = {'統括AI': 0, '調査担当': 2, '戦略担当': 0, '開発担当': 1, '企画担当': 3}

def a3_strip(name, key, state, spec, now, el, done, running, total, log, last=False):
    sc = STATE_C[state]
    fig, cap = PRODUCE[name]()
    w = WAIT[name]
    return ('<div style="display:flex;flex-direction:column;gap:7px;padding:13px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<div style="display:flex;align-items:center;gap:9px">'
              + orb(RGB[key], 24, state == '待機')
              + '<span style="font-size:13px">%s</span>' % name + dot(sc[0], 5)
              + '<span style="color:%s;font-size:11px">%s</span>' % (sc[1], state)
              + '<div style="flex:1"></div>'
              + '<span style="color:%s;font-size:10.5px;white-space:nowrap">%s</span>' % (T5, spec)
            + '</div>'
            + '<div style="padding-left:33px;display:flex;flex-direction:column;gap:7px">'
              + '<div style="display:flex;align-items:baseline;gap:8px">'
                + '<span style="color:%s;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;'
                  'white-space:nowrap">%s</span><div style="flex:1"></div>%s' % (T2, now, mono(el, T5) if el else '')
              + '</div>'
              + '<div style="display:flex;align-items:center;gap:9px">'
                + steps(done, running, total, HEX[key], 96)
                + '<span style="color:%s;font-size:11px">%d / %d · %s</span>' % (T5, done, total, STEPNAME[name])
              + '</div>'
              + '<div style="display:flex;align-items:center;gap:9px;min-height:11px">'
                + fig + (mono(cap) if cap else '')
                + '<div style="flex:1"></div>'
                + (mono('待ち %d' % w, T5) if w else '')
              + '</div>'
            + '</div></div>')

# ── 真ん中の図に「流れ」を出す ──────────────────────────────
# 弧は Work の進み。**その区間を誰がやったかで色を変える**（② THE TRACE を輪の上に巻いた形）。
# 色が変わるところ＝引き継ぎ。時計回りの矢羽根を置く。先端には尾を引かせる（いま動いている）。
FW, FH = 468, 560
FCX, FCY = 234, 280

def fpt(rx, ry, p):
    a = math.radians(-90 + 3.6 * p)
    return FCX + rx * math.cos(a), FCY + ry * math.sin(a)

def fseg(rx, ry, p0, p1, color, w=2.6, op=1.0, dash=None):
    x0, y0 = fpt(rx, ry, p0); x1, y1 = fpt(rx, ry, p1)
    large = 1 if (p1 - p0) > 50 else 0
    return ('<path d="M %.1f %.1f A %.1f %.1f 0 %d 1 %.1f %.1f" fill="none" stroke="%s" '
            'stroke-width="%s" stroke-linecap="round" opacity="%s"%s/>'
            % (x0, y0, rx, ry, large, x1, y1, color, w, op,
               ' stroke-dasharray="3 4"' if dash else ''))

def fhand(rx, ry, p, color):
    """引き継ぎの矢羽根。輪の接線に沿って、時計回りを向く"""
    a = math.radians(-90 + 3.6 * p)
    x, y = FCX + rx * math.cos(a), FCY + ry * math.sin(a)
    tx, ty = -rx * math.sin(a), ry * math.cos(a)
    L = math.hypot(tx, ty); tx, ty = tx / L, ty / L
    nx, ny = -ty, tx
    s = 5.0
    pts = '%.1f,%.1f %.1f,%.1f %.1f,%.1f' % (
        x + tx * s, y + ty * s,
        x - tx * s * .55 + nx * s * .78, y - ty * s * .55 + ny * s * .78,
        x - tx * s * .55 - nx * s * .78, y - ty * s * .55 - ny * s * .78)
    tick = ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#3A3A3A" stroke-width="1"/>'
            % (x + nx * 7, y + ny * 7, x - nx * 7, y - ny * 7))
    return tick + '<polygon points="%s" fill="%s"/>' % (pts, color)

def ftail(rx, ry, p, color):
    """先端の尾。**動いているものにだけ引く**"""
    out = ''
    for k, (back, r, o) in enumerate([(1.6, 2.6, .9), (4.0, 2.0, .5), (6.8, 1.5, .26)]):
        x, y = fpt(rx, ry, p - back)
        out += '<circle cx="%.1f" cy="%.1f" r="%s" fill="%s" opacity="%s"/>' % (x, y, r, color, o)
    return out

FRINGS = [
    # rx,  ry,  区間[(from,to,色)],                       先端, 判断待ち, 予定との差, Work名,             ひとこと
    (124,  86, [(0, 22, 'cyan'), (22, 52, 'purple')],      52,  True,  None,     '日本語学習サービス', None),
    (174, 120, [(0, 38, 'indigo')],                        38,  False, (38, 47), 'SNS運用の立ち上げ',  ('遅れ 2日', RED_T)),
    (226, 158, [(0, 26, 'indigo'), (26, 61, 'green')],     61,  False, None,     'LPと申込フォーム',   None),
]
# 社員は**自分がやった区間のまん中**に立つ。先端（いま）は尾を引く粒が言う
FEMP = [(0, 0, 22, '調査担当', 'cyan'), (0, 22, 52, '戦略担当', 'purple'),
        (1, 0, 38, '企画担当', 'indigo'), (2, 26, 61, '開発担当', 'green')]

def flow_board():
    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="display:block">' % (FW, FH, FW, FH)]
    g.append('<defs><radialGradient id="c2"><stop offset="0" stop-color="#D2D2D2" stop-opacity=".22"/>'
             '<stop offset="1" stop-color="#D2D2D2" stop-opacity="0"/></radialGradient></defs>')
    for rx, ry, segs, tip, gate, behind, _, _ in FRINGS:
        g.append('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="none" stroke="#1B1B1B" stroke-width="1"/>'
                 % (FCX, FCY, rx, ry))
        g.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#2E2E2E" stroke-width="1"/>'
                 % (FCX, FCY - ry - 5, FCX, FCY - ry + 5))
        if behind:                       # 予定との差。赤い点線ではみ出したぶんを見せる
            g.append(fseg(rx, ry, behind[0], behind[1], RED, 2.2, .85, dash=True))
        for k, (p0, p1, key) in enumerate(segs):
            g.append(fseg(rx, ry, p0, p1, HEX[key], 2.6, .95))
            if k:                        # 色が変わるところ＝引き継ぎ
                g.append(fhand(rx, ry, p0, HEX[key]))
        g.append(ftail(rx, ry, tip, HEX[segs[-1][2]]))
        if gate:
            # あなたが決めるところ。**先端の少し先**に立てる（この Work の次は、あなたの番）
            a = math.radians(-90 + 3.6 * tip)
            tx, ty = -rx * math.sin(a), ry * math.cos(a)
            L = math.hypot(tx, ty)
            x, y = FCX + rx * math.cos(a) + tx / L * 36, FCY + ry * math.sin(a) + ty / L * 36
            g.append('<circle cx="%.1f" cy="%.1f" r="11" fill="rgba(227,116,0,0.13)"/>' % (x, y))
            g.append('<rect x="%.1f" y="%.1f" width="9" height="9" rx="1.5" fill="%s" '
                     'transform="rotate(45 %.1f %.1f)"/>' % (x - 4.5, y - 4.5, AMBER, x, y))
    # 統括AI から、その区間を持っている人へ（割り当て。**引き継ぎより弱く**）
    for ri, p0, p1, _, _ in FEMP:
        rx, ry = FRINGS[ri][0], FRINGS[ri][1]
        x, y = fpt(rx, ry, (p0 + p1) / 2)
        dx, dy = x - FCX, y - FCY
        L = math.hypot(dx, dy)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#1F1F1F" stroke-width="1"/>'
                 % (FCX + dx / L * 32, FCY + dy / L * 32, FCX + dx / L * (L - 22), FCY + dy / L * (L - 22)))
    g.append('<circle cx="%d" cy="%d" r="44" fill="url(#c2)"/>' % (FCX, FCY))
    g.append('</svg>')

    out = ''.join(g)
    # Work 名は**輪のはじまり（真上）の横**に置く。輪が大きいほど上に来るので、どの名前がどの輪か迷わない
    for rx, ry, segs, tip, gate, behind, title, note in FRINGS:
        out += ('<div style="position:absolute;left:%dpx;top:%dpx;transform:translate(-100%%,-50%%);'
                'display:flex;align-items:center;gap:7px;white-space:nowrap">'
                '%s<span style="color:%s;font-size:11px">%s</span>%s'
                '<span style="width:12px;height:1px;background:#2E2E2E"></span></div>'
                % (FCX - 8, FCY - ry, dot(HEX[segs[-1][2]], 5), T3, title,
                   ('<span style="color:%s;font-size:11px">%s</span>' % (note[1], note[0])) if note else ''))
    out += ('<div style="position:absolute;left:%dpx;top:%dpx;transform:translate(-50%%,-50%%);'
            'display:flex;flex-direction:column;align-items:center;gap:6px">'
            '%s<span style="color:#E8E8E8;font-size:12.5px">統括AI</span></div>'
            % (FCX, FCY, orb(RGB['white'], 58, glow=.5)))
    for ri, p0, p1, name, key in FEMP:
        rx, ry = FRINGS[ri][0], FRINGS[ri][1]
        x, y = fpt(rx, ry, (p0 + p1) / 2)
        gate = FRINGS[ri][4] and p1 == FRINGS[ri][3]
        out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
                'display:flex;flex-direction:column;align-items:center;gap:6px;white-space:nowrap">'
                '%s<span style="color:%s;font-size:12px">%s</span></div>'
                % (x, y, orb(RGB[key], 40), AMBER_T if gate else T2, name))
    return '<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s</div>' % (FW, FH, out)

FEED_A3 = FEED + [
    ('08:12', '開発担当', 'フォームの下書きを 調査担当 から受け取りました', T3),
    ('08:04', '統括AI',   '企画担当 に投稿カレンダーを渡しました',        T3),
    ('07:51', '調査担当', '価格ページ 12件を読み終えました',              T3),
    ('07:40', '戦略担当', '調査担当 から事実 34件を受け取りました',       T3),
    ('07:22', '統括AI',   'SNS運用の立ち上げ が 2日 遅れています',        RED_T),
    ('07:05', '統括AI',   'きょうのぶんの計画を引き直しました',            T3),
    ('06:58', '開発担当', 'フォームの入力チェックを書きました',            T3),
    ('06:44', '調査担当', '価格表を3件ぶん書き出しました',                T3),
    ('06:30', '戦略администр'.replace('администр','担当'), '前提を4つ置きました', T3),
    ('06:12', '企画担当', '投稿の型を2つ決めました',                      T3),
    ('05:55', '統括AI',   '調査担当 に競合の追加調査を渡しました',         T3),
    ('05:40', '開発担当', 'LPの下書きを受け取りました',                   T3),
    ('05:22', '調査担当', '競合5件の機能を並べました',                    T3),
]

rail_a3 = ('<div style="width:300px;flex-shrink:0;display:flex;flex-direction:column">'
  '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
  '<span style="color:%s;font-size:11px">AI社員</span><div style="flex:1"></div>'
  '<span style="color:%s;font-size:10.5px">5人</span></div>' % (T5, T5)
  + ''.join(a3_strip(*m, last=(i == len(REAL) - 1)) for i, m in enumerate(REAL))
  + '</div>')

a3_body = ('<div style="padding:16px 30px 22px;display:flex;flex-direction:column;gap:12px">'
  '<div style="display:flex;align-items:baseline;gap:14px">'
    '<span style="font-size:16px;line-height:26px">3つの Work のうち<b style="color:%s">1つが遅れています</b>。'
    '<b style="color:%s">判断待ちが 1件</b>、要確認が 1件。</span>'
    '<div style="flex:1"></div>'
    '<span style="color:%s;font-size:11.5px">きょうの決定 <span class="tnum" style="color:%s">14</span>'
    '  ·  うちあなたが <span class="tnum" style="color:%s">2</span></span>'
    '<span style="width:1px;height:12px;background:%s"></span>'
    '<span style="color:%s;font-size:11.5px" class="tnum">稼働 4 / 4</span>'
  '</div>' % (RED_T, AMBER_T, T5, T2, T2, LINE, T5)
  + '<div style="display:flex;gap:22px;align-items:stretch">'
  + rail_a3
  + '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">%s</div>' % flow_board()
  + '<div style="width:288px;flex-shrink:0;display:flex;flex-direction:column;'
    'border-left:1px solid %s;padding-left:20px">' % HAIR
    + '<div style="display:flex;align-items:baseline;padding-bottom:2px">'
      '<span style="color:%s;font-size:11px">今日の出来事</span><div style="flex:1"></div>'
      '<span style="display:inline-flex;align-items:center;gap:6px;color:%s;font-size:10.5px">%s動いています</span></div>'
      % (T5, T5, dot(GREEN, 5))
    + ''.join(feed_row(t, w, x, c, i == len(FEED_A3) - 1) for i, (t, w, x, c) in enumerate(FEED_A3))
  + '</div></div>'
  + '</div>')

io.open(OUT + '/OptionA3.dc.html', 'w', encoding='utf-8').write(
    board('Work の行をやめて、絵に流れを出す', 'A3 採用ぶんを入れた', a3_body, BLUE_T))
print('A3 ok')

# ══════════════════════ 置き場所の4案（答えの一文をやめる） ══════════════════════
def flow(fw, fh, rings, orb_px=40, exec_px=58, labdeg=None):
    """輪＝Work。弧の色＝その区間を誰がやったか。色が変わるところが引き継ぎ"""
    cx, cy = fw / 2, fh / 2
    def pt(rx, ry, p):
        a = math.radians(-90 + 3.6 * p)
        return cx + rx * math.cos(a), cy + ry * math.sin(a)
    def seg(rx, ry, p0, p1, color, w=2.6, op=.95, dash=False):
        x0, y0 = pt(rx, ry, p0); x1, y1 = pt(rx, ry, p1)
        return ('<path d="M %.1f %.1f A %.1f %.1f 0 %d 1 %.1f %.1f" fill="none" stroke="%s" '
                'stroke-width="%s" stroke-linecap="round" opacity="%s"%s/>'
                % (x0, y0, rx, ry, 1 if p1 - p0 > 50 else 0, x1, y1, color, w, op,
                   ' stroke-dasharray="3 4"' if dash else ''))
    def hand(rx, ry, p, color):
        a = math.radians(-90 + 3.6 * p)
        x, y = pt(rx, ry, p)
        tx, ty = -rx * math.sin(a), ry * math.cos(a)
        L = math.hypot(tx, ty); tx, ty = tx / L, ty / L
        nx, ny = -ty, tx
        s_ = 5.0
        pts = '%.1f,%.1f %.1f,%.1f %.1f,%.1f' % (
            x + tx * s_, y + ty * s_,
            x - tx * s_ * .55 + nx * s_ * .78, y - ty * s_ * .55 + ny * s_ * .78,
            x - tx * s_ * .55 - nx * s_ * .78, y - ty * s_ * .55 - ny * s_ * .78)
        return ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#3A3A3A" stroke-width="1"/>'
                '<polygon points="%s" fill="%s"/>'
                % (x + nx * 7, y + ny * 7, x - nx * 7, y - ny * 7, pts, color))

    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="display:block">' % (fw, fh, fw, fh)]
    g.append('<defs><radialGradient id="cg%d"><stop offset="0" stop-color="#D2D2D2" stop-opacity=".22"/>'
             '<stop offset="1" stop-color="#D2D2D2" stop-opacity="0"/></radialGradient></defs>' % fw)
    for rx, ry, segs, tip, gate, behind, _, _ in rings:
        g.append('<ellipse cx="%.0f" cy="%.0f" rx="%d" ry="%d" fill="none" stroke="#1B1B1B" stroke-width="1"/>'
                 % (cx, cy, rx, ry))
        g.append('<line x1="%.0f" y1="%.1f" x2="%.0f" y2="%.1f" stroke="#2E2E2E" stroke-width="1"/>'
                 % (cx, cy - ry - 5, cx, cy - ry + 5))
        if behind:
            g.append(seg(rx, ry, behind[0], behind[1], RED, 2.2, .85, dash=True))
        for k, (p0, p1, key) in enumerate(segs):
            g.append(seg(rx, ry, p0, p1, HEX[key]))
            if k:
                g.append(hand(rx, ry, p0, HEX[key]))
        for back, r, o in [(1.6, 2.6, .9), (4.0, 2.0, .5), (6.8, 1.5, .26)]:
            x, y = pt(rx, ry, tip - back)
            g.append('<circle cx="%.1f" cy="%.1f" r="%s" fill="%s" opacity="%s"/>'
                     % (x, y, r, HEX[segs[-1][2]], o))
        if gate:
            a = math.radians(-90 + 3.6 * tip)
            tx, ty = -rx * math.sin(a), ry * math.cos(a)
            L = math.hypot(tx, ty)
            x, y = pt(rx, ry, tip)
            x += tx / L * 36; y += ty / L * 36
            g.append('<circle cx="%.1f" cy="%.1f" r="11" fill="rgba(227,116,0,0.13)"/>' % (x, y))
            g.append('<rect x="%.1f" y="%.1f" width="9" height="9" rx="1.5" fill="%s" '
                     'transform="rotate(45 %.1f %.1f)"/>' % (x - 4.5, y - 4.5, AMBER, x, y))
    for ri, p0, p1, _, _ in FEMP:
        rx, ry = rings[ri][0], rings[ri][1]
        x, y = pt(rx, ry, (p0 + p1) / 2)
        dx, dy = x - cx, y - cy
        L = math.hypot(dx, dy)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#1F1F1F" stroke-width="1"/>'
                 % (cx + dx / L * 32, cy + dy / L * 32, cx + dx / L * (L - 22), cy + dy / L * (L - 22)))
    g.append('<circle cx="%.0f" cy="%.0f" r="44" fill="url(#cg%d)"/>' % (cx, cy, fw))
    g.append('</svg>')

    out = ''.join(g)
    for k, (rx, ry, segs, tip, gate, behind, title, note) in enumerate(rings):
        if labdeg:
            a = math.radians(labdeg[k])
            lx, ly = cx + rx * math.cos(a) + 1, cy + ry * math.sin(a)
        else:
            lx, ly = cx - 8, cy - ry
        out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-100%%,-50%%);'
                'display:flex;align-items:center;gap:7px;white-space:nowrap">'
                '%s<span style="color:%s;font-size:11px">%s</span>%s'
                '<span style="width:12px;height:1px;background:#2E2E2E"></span></div>'
                % (lx, ly, dot(HEX[segs[-1][2]], 5), T3, title,
                   ('<span style="color:%s;font-size:11px">%s</span>' % (note[1], note[0])) if note else ''))
    out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
            'display:flex;flex-direction:column;align-items:center;gap:6px">'
            '%s<span style="color:#E8E8E8;font-size:12.5px">統括AI</span></div>'
            % (cx, cy, orb(RGB['white'], exec_px, glow=.5)))
    for ri, p0, p1, name, key in FEMP:
        rx, ry = rings[ri][0], rings[ri][1]
        x, y = pt(rx, ry, (p0 + p1) / 2)
        gate = rings[ri][4] and p1 == rings[ri][3]
        out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
                'display:flex;flex-direction:column;align-items:center;gap:6px;white-space:nowrap">'
                '%s<span style="color:%s;font-size:12px">%s</span></div>'
                % (x, y, orb(RGB[key], orb_px), AMBER_T if gate else T2, name))
    return '<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s</div>' % (fw, fh, out)

def ringset(a, b, c):
    return [(a[0], a[1], [(0, 22, 'cyan'), (22, 52, 'purple')], 52, True,  None,     '日本語学習サービス', None),
            (b[0], b[1], [(0, 38, 'indigo')],                   38, False, (38, 47), 'SNS運用の立ち上げ',  ('遅れ 2日', RED_T)),
            (c[0], c[1], [(0, 26, 'indigo'), (26, 61, 'green')], 61, False, None,    'LPと申込フォーム',   None)]

# 上の帯。**答えの一文はやめた**（遅れは赤い点線、判断待ちは橙の菱形が絵で言っている）
def topline():
    return ('<div style="display:flex;align-items:baseline;gap:14px;height:18px">'
            '<div style="flex:1"></div>'
            '<span style="color:%s;font-size:11.5px">きょうの決定 <span class="tnum" style="color:%s">14</span>'
            '  ·  うちあなたが <span class="tnum" style="color:%s">2</span></span>'
            '<span style="width:1px;height:12px;background:%s"></span>'
            '<span style="color:%s;font-size:11.5px" class="tnum">稼働 4 / 4</span></div>'
            % (T5, T2, T2, LINE, T5))

def sec(t, right=''):
    return ('<div style="display:flex;align-items:baseline;padding-bottom:2px">'
            '<span style="color:%s;font-size:11px">%s</span><div style="flex:1"></div>'
            '<span style="color:%s;font-size:10.5px">%s</span></div>' % (T5, t, T5, right))

def logcol(n=12, w=288, h=None):
    """ログは**縦にスクロール**する。下端はグラデーションに溶かして「まだある」と分かるように"""
    rows = ''.join(feed_row(t, a, x, c, i == n - 1) for i, (t, a, x, c) in enumerate(FEED_A3[:n]))
    if h is None:
        return ('<div style="width:%dpx;flex-shrink:0;display:flex;flex-direction:column;'
                'border-left:1px solid %s;padding-left:20px">%s%s</div>'
                % (w, HAIR, sec('今日の出来事', '動いています'), rows))
    return ('<div style="width:%dpx;flex-shrink:0;display:flex;flex-direction:column;'
            'border-left:1px solid %s;padding-left:20px">%s'
            '<div style="position:relative;height:%dpx;min-height:0">'
            '<div class="sy" style="position:absolute;inset:0;padding-right:8px">%s</div>'
            '<div style="position:absolute;left:0;right:0;bottom:0;height:36px;pointer-events:none;'
            'background:linear-gradient(rgba(0,0,0,0), #000)"></div>'
            '</div></div>'
            % (w, HAIR, sec('今日の出来事', '動いています'), h, rows))

def logband(cols=4, rows=3):
    """ログを横に流す。時系列なので左→右・上→下で読める"""
    items = FEED_A3[:cols * rows]
    out = ''
    for r in range(rows):
        cells = ''
        for c in range(cols):
            k = r * cols + c
            if k >= len(items):
                cells += '<div style="flex:1"></div>'
                continue
            t, who, what, col = items[k]
            cells += ('<div style="flex:1;min-width:0;display:flex;align-items:baseline;gap:9px;'
                      'padding:8px 0;%s">%s'
                      '<span style="color:%s;font-size:11px;width:52px;flex-shrink:0">%s</span>'
                      '<span style="flex:1;min-width:0;color:%s;font-size:11.5px;overflow:hidden;'
                      'text-overflow:ellipsis;white-space:nowrap">%s</span></div>'
                      % ('' if r == rows - 1 else 'border-bottom:1px solid #131313',
                         mono(t), T5, who, col, what))
        out += '<div style="display:flex;gap:24px">%s</div>' % cells
    return '<div>%s%s</div>' % (sec('今日の出来事', '動いています'), out)

def strip3(name, key, state, spec, now, el, done, running, total, log, last=False):
    """3段。②のように下に何か置くとき用"""
    sc = STATE_C[state]
    fig, cap = PRODUCE[name]()
    return ('<div style="display:flex;flex-direction:column;gap:6px;padding:11px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<div style="display:flex;align-items:center;gap:9px">'
              + orb(RGB[key], 22) + '<span style="font-size:12.5px">%s</span>' % name + dot(sc[0], 5)
              + '<span style="color:%s;font-size:11px">%s</span><div style="flex:1"></div>%s'
                % (sc[1], state, mono(el, T5) if el else '')
            + '</div>'
            + '<div style="padding-left:31px;display:flex;flex-direction:column;gap:6px">'
              + '<span style="color:%s;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;'
                'white-space:nowrap">%s</span>' % (T2, now)
              + '<div style="display:flex;align-items:center;gap:9px">'
                + steps(done, running, total, HEX[key], 72)
                + '<span style="color:%s;font-size:10.5px;white-space:nowrap">%d / %d</span>' % (T5, done, total)
                + '<div style="flex:1"></div>' + fig + (mono(cap) if cap else '')
              + '</div>'
            + '</div></div>')

def card(name, key, state, spec, now, el, done, running, total, log):
    """③ 下に横並びにするとき用。1人ぶんを縦に積む"""
    sc = STATE_C[state]
    fig, cap = PRODUCE[name]()
    w = WAIT[name]
    return ('<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">'
            + '<div style="display:flex;align-items:center;gap:8px">'
              + orb(RGB[key], 24) + '<span style="font-size:12.5px">%s</span>' % name + dot(sc[0], 5)
              + '<span style="color:%s;font-size:10.5px">%s</span>' % (sc[1], state)
            + '</div>'
            + '<span style="color:%s;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;'
              'white-space:nowrap">%s</span>' % (T2, now)
            + '<div style="display:flex;align-items:center;gap:8px">'
              + steps(done, running, total, HEX[key], 96)
              + '<span style="color:%s;font-size:10.5px;white-space:nowrap">%d / %d</span>' % (T5, done, total)
              + '<div style="flex:1"></div>' + (mono(el, T5) if el else '')
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:8px;min-height:11px">'
              + fig + (mono(cap) if cap else '') + '<div style="flex:1"></div>'
              + (mono('待ち %d' % w, T5) if w else '')
            + '</div></div>')

def strip2(name, key, state, spec, now, el, done, running, total, log, last=False):
    """④ 右の1列に社員とログを積むとき用。いちばん細い"""
    sc = STATE_C[state]
    fig, cap = PRODUCE[name]()
    return ('<div style="display:flex;flex-direction:column;gap:6px;padding:10px 0;%s">'
            % ('' if last else 'border-bottom:1px solid %s' % HAIR)
            + '<div style="display:flex;align-items:center;gap:8px">'
              + orb(RGB[key], 20) + '<span style="font-size:12.5px">%s</span>' % name + dot(sc[0], 5)
              + '<div style="flex:1"></div>'
              + '<span style="color:%s;font-size:11px;overflow:hidden;text-overflow:ellipsis;'
                'white-space:nowrap;max-width:150px">%s</span>' % (T5, now)
            + '</div>'
            + '<div style="padding-left:28px;display:flex;align-items:center;gap:8px;overflow:hidden">'
              + steps(done, running, total, HEX[key], 44)
              + '<div style="flex:1"></div>' + fig + (mono(cap) if cap else '')
            + '</div></div>')

COMPOSER_NOTE = 108   # 下に置いたものは入力欄のぶん逃がす（52 ＋ 窓の下との間 24 ＋ 中身との間 32）

ICONS = {
  'team': '<circle cx="9.2" cy="8.6" r="3.1"/><path d="M4 19.2c0-2.9 2.3-5.2 5.2-5.2s5.2 2.3 5.2 5.2"/>'
          '<path d="M15.6 5.9a3 3 0 0 1 0 5.5M17.6 14.4c1.8.8 3 2.6 3 4.8"/>',
  'panel': '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M9.5 5v14"/>',
  'check': '<path d="m5 12.5 4 4 9-10"/>',
  'roadmap': '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/>'
             '<path d="M6 8.2v7.6M8.2 6H15a3 3 0 0 1 3 3v0"/>',
  'hand': '<path d="M8 12.5V6.2a1.4 1.4 0 0 1 2.8 0v5M10.8 11V5.2a1.4 1.4 0 0 1 2.8 0v5.6'
          'M13.6 11.2V6.4a1.4 1.4 0 0 1 2.8 0V14c0 3.3-2 5.8-5 5.8-2.6 0-3.9-1.4-5.2-3.6l-1.5-2.6'
          'a1.4 1.4 0 0 1 2.3-1.6l.8 1.1"/>',
  'expand': '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9'
            'M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  'minus': '<path d="M6 12h12"/>',
  'plus': '<path d="M12 5.5v13M5.5 12h13"/>',
  # 選ぶ道具。Figma と同じ「左上を向いた矢印」
  'cursor': '<path d="M6.5 3.6 18 12.2l-5.1.5-1.2 5z" stroke-linejoin="round"/>',
}

def icon(n, c=T4, size=14, w=1.5):
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:block">%s</svg>'
            % (size, size, c, w, ICONS[n]))

def pills(active='オフィス'):
    """ホームの4ビュー切替。**上部ピル**（ホームだけ右ペインなしの全幅）"""
    out = ''
    for label, ic in [('オフィス', 'team'), ('デスク', 'panel'), ('進捗', 'check'), ('ワークフロー', 'roadmap')]:
        on = label == active
        out += ('<span style="display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 15px;'
                'border-radius:999px;%scolor:%s;white-space:nowrap;font-size:13px">%s%s</span>'
                % ('background:#2A2A2A;' if on else '', T1 if on else T4,
                   icon(ic, T1 if on else T4), label))
    return ('<div style="display:flex;justify-content:center">'
            '<div style="display:inline-flex;align-items:center;gap:3px;padding:4px;border-radius:999px;'
            'background:#141414;border:1px solid %s">%s</div></div>' % (LINE, out))

def composer():
    """入力欄。**全画面で同じものを1つ**・中央下部・幅748・高さ52・角丸26。
       中身の上に浮くので、下に貼り付く行は COMPOSER_NOTE ぶん逃がす"""
    return ('<div style="position:absolute;left:50%%;bottom:24px;transform:translateX(-50%%);'
            'width:748px;height:52px;border-radius:26px;background:#0E0E0E;border:1px solid %s;'
            'display:flex;align-items:center;gap:12px;padding:0 8px 0 14px">' % LINE
            + '<span style="width:26px;height:26px;border-radius:999px;display:inline-flex;'
              'align-items:center;justify-content:center;color:%s;font-size:15px;flex-shrink:0">＋</span>' % T4
            + '<span style="flex:1;min-width:0;color:%s;font-size:14px">統括AIに話しかける</span>' % T4
            + '<span style="color:%s;font-size:12px;white-space:nowrap">統括AI</span>' % T3
            + '<span style="color:%s;font-size:12px;white-space:nowrap">自動 ⌄</span>' % T3
            + '<span style="width:34px;height:34px;border-radius:999px;background:#1C1C1C;flex-shrink:0;'
              'display:inline-flex;align-items:center;justify-content:center;color:%s;font-size:14px">↑</span>' % T5
            + '</div>')

# ── ① 左右 ────────────────────────────────────────────────
b1 = ('<div style="padding:16px 30px 22px;display:flex;flex-direction:column;gap:10px">'
  + topline()
  + '<div style="display:flex;gap:22px;align-items:stretch">'
    + '<div style="width:300px;flex-shrink:0;display:flex;flex-direction:column">'
      + sec('AI社員', '5人')
      + ''.join(a3_strip(*m, last=(i == len(REAL) - 1)) for i, m in enumerate(REAL)) + '</div>'
    + '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">%s</div>'
      % flow(468, 560, ringset((124, 86), (174, 120), (226, 158)))
    + logcol(12)
  + '</div></div>')
io.open(OUT + '/LayoutSides.dc.html', 'w', encoding='utf-8').write(
    board('社員は左、ログは右、絵はまんなか', '① 左右', b1, BLUE_T,
          '引き換えに: 絵がいちばん小さい（468幅）'))
print('L1 ok')

# ── ② 下にログ ────────────────────────────────────────────
b2 = ('<div style="padding:16px 30px 22px;display:flex;flex-direction:column;gap:10px">'
  + topline()
  + '<div style="display:flex;gap:22px;align-items:stretch">'
    + '<div style="width:300px;flex-shrink:0;display:flex;flex-direction:column">'
      + sec('AI社員', '5人')
      + ''.join(strip3(*m, last=(i == len(REAL) - 1)) for i, m in enumerate(REAL)) + '</div>'
    + '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">%s</div>'
      % flow(798, 440, ringset((215, 95), (302, 133), (388, 171)))
  + '</div>'
  + '<div style="padding-top:8px;margin-bottom:%dpx;border-top:1px solid %s">%s</div>'
    % (COMPOSER_NOTE, HAIR, logband(4, 3))
  + '</div>')
io.open(OUT + '/LayoutLogBottom.dc.html', 'w', encoding='utf-8').write(
    board('絵を横に広く。ログは下に流す', '② 下にログ', b2, BLUE_T,
          '引き換えに: 社員の行が1段減る ＋ 入力欄のぶん 108px'))
print('L2 ok')

# ── ④ 右に1本 ─────────────────────────────────────────────
b4 = ('<div style="padding:16px 30px 22px;display:flex;flex-direction:column;gap:10px">'
  + topline()
  + '<div style="display:flex;gap:22px;align-items:stretch">'
    + '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">%s</div>'
      % flow(798, 620, ringset((215, 135), (302, 189), (388, 243)))
    + '<div style="width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:22px;'
      'border-left:1px solid %s;padding-left:20px">' % HAIR
      + '<div>' + sec('AI社員', '5人')
        + ''.join(strip2(*m, last=(i == len(REAL) - 1)) for i, m in enumerate(REAL)) + '</div>'
      + '<div>' + sec('今日の出来事', '動いています')
        + ''.join(feed_row(t, a, x, c, i == 5) for i, (t, a, x, c) in enumerate(FEED_A3[:6])) + '</div>'
    + '</div>'
  + '</div></div>')
io.open(OUT + '/LayoutOneColumn.dc.html', 'w', encoding='utf-8').write(
    board('左レールをやめて、読むものは右の1列に', '④ 右に1本', b4, BLUE_T,
          '引き換えに: ログが6件しか出ない'))
print('L4 ok')

# ══════════════════════ 図の作り直し（意味のない要素をなくす） ══════════════════════
# 1つの Work は「フェーズが順番に進む道」。データはこれで全部そろう。
#   name / 総週数 / [(フェーズ名, 週数, その区間をやった人 or None)] / いまの位置(週) /
#   [(位置, 名前, 色, 判断待ちか)] / 予定との差
WF = [
    ('日本語学習サービス', 10,
     [('調査', 3, 'cyan'), ('戦略', 3, 'purple'), ('プロダクト', 2, None), ('ローンチ', 2, None)],
     5.2, [(1.5, '調査担当', 'cyan', False), (4.1, '戦略担当', 'purple', True)], None, '戦略'),
    ('SNS運用の立ち上げ', 5,
     [('準備', 1, 'indigo'), ('運用設計', 2, 'indigo'), ('運用', 2, None)],
     1.9, [(1.45, '企画担当', 'indigo', False)], (1.9, 2.6), '運用設計'),
    ('LPと申込フォーム', 7,
     [('設計', 2, 'indigo'), ('制作', 3, 'green'), ('公開', 2, None)],
     4.27, [(3.14, '開発担当', 'green', False)], None, '制作'),
]

def tri(x, y, dx, dy, s_, color):
    """進む向きの矢羽根"""
    L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
    nx, ny = -dy, dx
    return ('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>'
            % (x + dx * s_, y + dy * s_,
               x - dx * s_ * .55 + nx * s_ * .78, y - dy * s_ * .55 + ny * s_ * .78,
               x - dx * s_ * .55 - nx * s_ * .78, y - dy * s_ * .55 - ny * s_ * .78, color))

# ── 図B 川（横＝フェーズ） ───────────────────────────────────
def fig_river(fw=810, fh=404):
    X0, X1 = 196, fw - 26
    W_ = X1 - X0
    lanes = [92, 202, 312]
    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="position:absolute;inset:0">' % (fw, fh, fw, fh)]
    html = ''
    # 統括AI から各 Work のはじまりへ（仕事が生まれるところ）
    for y in lanes:
        g.append('<path d="M 64 %d C 120 %d 120 %.0f 190 %.0f" fill="none" stroke="#1F1F1F" stroke-width="1"/>'
                 % (fh // 2, fh // 2, y, y))
    for li, (name, tot, phases, at, emps, behind, curph) in enumerate(WF):
        y = lanes[li]
        ty = y                                         # 道の高さ
        cum = 0.0
        # フェーズの区切りと名前
        for pi, (pn, wk, holder) in enumerate(phases):
            x0 = X0 + W_ * cum / tot
            x1 = X0 + W_ * (cum + wk) / tot
            if pi:
                g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#232323" stroke-width="1"/>'
                         % (x0, ty - 13, x0, ty + 13))
            # 道: 済んだぶんは担当の色、これからは暗い面
            g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="6" rx="3" fill="#161616"/>'
                     % (x0 + 1, ty - 3, max(0, x1 - x0 - 2)))
            fill = min(x1, X0 + W_ * at / tot)
            if fill > x0 and holder:
                cur = cum + wk > at                    # いまいるフェーズ
                g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="6" rx="3" fill="%s" opacity="%s"/>'
                         % (x0 + 1, ty - 3, max(0, fill - x0 - 2), HEX[holder], '.95' if cur else '.5'))
            if pi:                                     # 担当が変わるところ＝引き継ぎ
                if holder and phases[pi - 1][2] and holder != phases[pi - 1][2] and x0 <= X0 + W_ * at / tot:
                    g.append(tri(x0, ty, 1, 0, 5.0, HEX[holder]))
            html += ('<div style="position:absolute;left:%.1fpx;top:%.1fpx;color:%s;font-size:10px;'
                     'white-space:nowrap">%s</div>' % (x0 + 5, ty - 26, T5 if x1 - x0 > 44 else 'transparent', pn))
            cum += wk
        # 予定との差
        if behind:
            b0, b1 = X0 + W_ * behind[0] / tot, X0 + W_ * behind[1] / tot
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2" '
                     'stroke-dasharray="3 4" stroke-linecap="round"/>' % (b0, ty, b1, ty, RED))
        # 判断待ち＝先端のすぐ先に橙の菱形
        gate = [e for e in emps if e[3]]
        if gate:
            gx = X0 + W_ * at / tot + 16
            g.append('<circle cx="%.1f" cy="%.1f" r="11" fill="rgba(227,116,0,0.13)"/>' % (gx, ty))
            g.append('<rect x="%.1f" y="%.1f" width="9" height="9" rx="1.5" fill="%s" '
                     'transform="rotate(45 %.1f %.1f)"/>' % (gx - 4.5, ty - 4.5, AMBER, gx, ty))
        # Work 名（左）
        html += ('<div style="position:absolute;left:0px;top:%.1fpx;width:%dpx;text-align:right;'
                 'display:flex;align-items:center;justify-content:flex-end;gap:7px;white-space:nowrap">'
                 '<span style="color:%s;font-size:11.5px">%s</span>%s</div>'
                 % (ty - 8, X0 - 16, T3, name, dot(HEX[phases[-1][2] or emps[-1][2]], 5)))
        # 社員は道の上に立つ。**いるフェーズの真上**
        for ex, en, ek, eg in emps:
            x = X0 + W_ * ex / tot
            # **道の上に立つ**（いるフェーズの真上）。名前は下
            html += ('<div style="position:absolute;left:%.1fpx;top:%.1fpx;transform:translate(-50%%,-50%%);'
                     'display:flex">%s</div>'
                     '<div style="position:absolute;left:%.1fpx;top:%.1fpx;transform:translateX(-50%%);'
                     'color:%s;font-size:11px;white-space:nowrap">%s</div>'
                     % (x, ty, orb(RGB[ek], 28), x, ty + 20, AMBER_T if eg else T2, en))
    g.append('</svg>')
    html += ('<div style="position:absolute;left:18px;top:%dpx;transform:translateY(-50%%);'
             'display:flex;flex-direction:column;align-items:center;gap:6px">'
             '%s<span style="color:#E8E8E8;font-size:11.5px">統括AI</span></div>'
             % (fh // 2, orb(RGB['white'], 44, glow=.5)))
    return ('<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s%s</div>'
            % (fw, fh, ''.join(g), html))

# ── 図A フェーズの扇（中心から外へ ＝ 完成に近づく） ─────────────
def fig_fan(fw=810, fh=404):
    cx, cy = fw / 2, fh - 34
    RX, RY = 290, 286
    ANG = [150, 90, 30]
    def pt(f, a):
        r = math.radians(a)
        return cx + f * RX * math.cos(r), cy - f * RY * math.sin(r)
    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="position:absolute;inset:0">' % (fw, fh, fw, fh)]
    for f, c in [(.25, '#151515'), (.5, '#151515'), (.75, '#151515'), (1.0, '#242424')]:
        x0, y0 = pt(f, 176); x1, y1 = pt(f, 4)
        g.append('<path d="M %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f" fill="none" stroke="%s" stroke-width="1"/>'
                 % (x0, y0, f * RX, f * RY, x1, y1, c))
    html = ''
    for li, (name, tot, phases, at, emps, behind, curph) in enumerate(WF):
        a = ANG[li]
        cum = 0.0
        # 道（薄い線）
        x0, y0 = pt(0.10, a); x1, y1 = pt(1.0, a)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#161616" stroke-width="6" '
                 'stroke-linecap="round"/>' % (x0, y0, x1, y1))
        for pi, (pn, wk, holder) in enumerate(phases):
            f0, f1 = .10 + .90 * cum / tot, .10 + .90 * (cum + wk) / tot
            ff = .10 + .90 * at / tot
            if pi:                                   # フェーズの境目
                bx, by = pt(f0, a)
                dx, dy = pt(f0 + .02, a)[0] - bx, pt(f0 + .02, a)[1] - by
                L = math.hypot(dx, dy)
                g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#2E2E2E" stroke-width="1"/>'
                         % (bx - dy / L * 7, by + dx / L * 7, bx + dy / L * 7, by - dx / L * 7))
            if holder and ff > f0:
                ex, ey = pt(min(f1, ff), a); sx, sy = pt(f0, a)
                cur = cum + wk > at
                g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="6" '
                         'stroke-linecap="round" opacity="%s"/>' % (sx, sy, ex, ey, HEX[holder], '.95' if cur else '.5'))
                if pi and phases[pi - 1][2] and holder != phases[pi - 1][2]:
                    dx, dy = pt(f0 + .02, a)[0] - sx, pt(f0 + .02, a)[1] - sy
                    g.append(tri(sx, sy, dx, dy, 5.0, HEX[holder]))
            cum += wk
        if behind:
            f0, f1 = .10 + .90 * behind[0] / tot, .10 + .90 * behind[1] / tot
            bx0, by0 = pt(f0, a); bx1, by1 = pt(f1, a)
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2.4" '
                     'stroke-dasharray="3 4" stroke-linecap="round"/>' % (bx0, by0, bx1, by1, RED))
        gate = [e for e in emps if e[3]]
        if gate:
            gx, gy = pt(.10 + .90 * at / tot + .05, a)
            g.append('<circle cx="%.1f" cy="%.1f" r="11" fill="rgba(227,116,0,0.13)"/>' % (gx, gy))
            g.append('<rect x="%.1f" y="%.1f" width="9" height="9" rx="1.5" fill="%s" '
                     'transform="rotate(45 %.1f %.1f)"/>' % (gx - 4.5, gy - 4.5, AMBER, gx, gy))
        # Work 名は道の先（外）に
        tx, ty = pt(1.06, a)
        al = 'flex-end' if a > 100 else ('center' if a == 90 else 'flex-start')
        html += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(%s,-50%%);'
                 'display:flex;align-items:center;gap:7px;white-space:nowrap">%s'
                 '<span style="color:%s;font-size:11px">%s</span></div>'
                 % (tx, ty, '-100%' if a > 100 else ('-50%' if a == 90 else '0'),
                    dot(HEX[phases[-1][2] or emps[-1][2]], 5), T3, name))
        nudge = {150: (-30, 18), 90: (38, 2), 30: (30, 18)}[a]
        for ef, en, ek, eg in emps:
            f = .10 + .90 * ef / tot
            x, y = pt(f, a)
            lead = ef == max(e2[0] for e2 in emps)
            html += ('<div style="position:absolute;left:%.1fpx;top:%.1fpx;transform:translate(-50%%,-50%%);'
                     'display:flex">%s</div>'
                     '<div style="position:absolute;left:%.1fpx;top:%.1fpx;transform:translate(-50%%,0);'
                     'display:flex;flex-direction:column;align-items:center;gap:2px;white-space:nowrap">'
                     '<span style="color:%s;font-size:11px">%s</span>%s</div>'
                     % (x, y, orb(RGB[ek], 30),
                        x + nudge[0], y + nudge[1], AMBER_T if eg else T2, en,
                        ('<span style="color:%s;font-size:10px">%s</span>' % (T5, curph)) if lead else ''))
    g.append('</svg>')
    html += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
             'display:flex;flex-direction:column;align-items:center;gap:5px">'
             '%s<span style="color:#E8E8E8;font-size:11.5px">統括AI</span></div>'
             % (cx, cy - 4, orb(RGB['white'], 44, glow=.5)))
    x1, y1 = pt(1.0, 4)
    html += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;color:%s;font-size:10px">完了</div>'
             % (x1 + 6, y1 - 6, DIM))
    return ('<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s%s</div>'
            % (fw, fh, ''.join(g), html))

# ── 図C いまの輪＋フェーズの刻み ─────────────────────────────
CR = [(196, 84), (276, 118), (356, 152)]
CSEG = [[(0, 30, 'cyan'), (30, 52, 'purple')], [(0, 38, 'indigo')], [(0, 28.57, 'indigo'), (28.57, 61, 'green')]]
CTICK = [[30, 60, 80], [20, 60], [28.57, 71.43]]
CEMP = [[(15, '調査担当', 'cyan', False), (41, '戦略担当', 'purple', True)],
        [(19, '企画担当', 'indigo', False)], [(44.8, '開発担当', 'green', False)]]
CLAB = [198, 225, 242]

def fig_rings(fw=810, fh=404):
    cx, cy = fw / 2, fh / 2
    def pt(rx, ry, p):
        a = math.radians(-90 + 3.6 * p)
        return cx + rx * math.cos(a), cy + ry * math.sin(a)
    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="position:absolute;inset:0">' % (fw, fh, fw, fh)]
    for li, (rx, ry) in enumerate(CR):
        name, tot, phases, at, _, behind, curph = WF[li]
        g.append('<ellipse cx="%.0f" cy="%.0f" rx="%d" ry="%d" fill="none" stroke="#1B1B1B" stroke-width="1"/>'
                 % (cx, cy, rx, ry))
        # 真上がはじまり
        x, y = pt(rx, ry, 0)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#2E2E2E" stroke-width="1"/>'
                 % (x, y - 5, x, y + 5))
        for k, (p0, p1, key) in enumerate(CSEG[li]):
            x0, y0 = pt(rx, ry, p0); x1, y1 = pt(rx, ry, p1)
            g.append('<path d="M %.1f %.1f A %.1f %.1f 0 %d 1 %.1f %.1f" fill="none" stroke="%s" '
                     'stroke-width="2.6" stroke-linecap="round" opacity=".95"/>'
                     % (x0, y0, rx, ry, 1 if p1 - p0 > 50 else 0, x1, y1, HEX[key]))
            if k:
                a = math.radians(-90 + 3.6 * p0)
                tx, ty2 = -rx * math.sin(a), ry * math.cos(a)
                g.append(tri(x0, y0, tx, ty2, 5.0, HEX[key]))
        tip = CSEG[li][-1][1]
        for back, r, o in [(1.6, 2.6, .9), (4.0, 2.0, .5), (6.8, 1.5, .26)]:
            x, y = pt(rx, ry, tip - back)
            g.append('<circle cx="%.1f" cy="%.1f" r="%s" fill="%s" opacity="%s"/>' % (x, y, r, HEX[CSEG[li][-1][2]], o))
        if behind:
            b0, b1 = tip, tip + (behind[1] - behind[0]) / tot * 100
            x0, y0 = pt(rx, ry, b0); x1, y1 = pt(rx, ry, b1)
            g.append('<path d="M %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f" fill="none" stroke="%s" '
                     'stroke-width="2.2" stroke-dasharray="3 4" stroke-linecap="round"/>' % (x0, y0, rx, ry, x1, y1, RED))
        if any(e[3] for e in CEMP[li]):
            a = math.radians(-90 + 3.6 * tip)
            tx, ty2 = -rx * math.sin(a), ry * math.cos(a)
            L = math.hypot(tx, ty2)
            x, y = pt(rx, ry, tip)
            x += tx / L * 34; y += ty2 / L * 34
            g.append('<circle cx="%.1f" cy="%.1f" r="11" fill="rgba(227,116,0,0.13)"/>' % (x, y))
            g.append('<rect x="%.1f" y="%.1f" width="9" height="9" rx="1.5" fill="%s" '
                     'transform="rotate(45 %.1f %.1f)"/>' % (x - 4.5, y - 4.5, AMBER, x, y))
    for li, (rx, ry) in enumerate(CR):
        for ep, en, ek, eg in CEMP[li]:
            x, y = pt(rx, ry, ep)
            dx, dy = x - cx, y - cy
            L = math.hypot(dx, dy)
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#1F1F1F" stroke-width="1"/>'
                     % (cx + dx / L * 30, cy + dy / L * 30, cx + dx / L * (L - 20), cy + dy / L * (L - 20)))
    g.append('</svg>')
    out = ''.join(g)
    for li, (rx, ry) in enumerate(CR):
        name, tot, phases, at, _, behind, curph = WF[li]
        a = math.radians(CLAB[li])
        x, y = cx + rx * math.cos(a) + 1, cy + ry * math.sin(a)
        out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-100%%,-50%%);'
                'display:flex;align-items:center;gap:7px;white-space:nowrap">'
                '%s<span style="color:%s;font-size:11px">%s</span>'
                '<span style="width:12px;height:1px;background:#2E2E2E"></span></div>'
                % (x, y, dot(HEX[CSEG[li][-1][2]], 5), T3, name))
    out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
            'display:flex;flex-direction:column;align-items:center;gap:6px">'
            '%s<span style="color:#E8E8E8;font-size:12px">統括AI</span></div>'
            % (cx, cy, orb(RGB['white'], 44, glow=.5)))
    for li, (rx, ry) in enumerate(CR):
        curph = WF[li][6]
        lead = max(e[0] for e in CEMP[li])
        for ep, en, ek, eg in CEMP[li]:
            x, y = pt(rx, ry, ep)
            out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
                    'display:flex;flex-direction:column;align-items:center;gap:5px;white-space:nowrap">'
                    '%s<span style="color:%s;font-size:11.5px">%s</span>%s</div>'
                    % (x, y, orb(RGB[ek], 32), AMBER_T if eg else T2, en,
                       ('<span style="color:%s;font-size:10px">%s</span>' % (T5, curph)) if ep == lead else ''))
    return '<div style="position:relative;width:%dpx;height:%dpx;flex-shrink:0">%s</div>' % (fw, fh, out)

def figboard(title, tag, note, fig, tagcolor=BLUE_T):
    return board(title, tag,
                 '<div style="padding:30px 0 34px;display:flex;justify-content:center">%s</div>' % fig,
                 tagcolor, note)

# ── ③ 下に社員（採用）──────────────────────────────────────
def doc_icon(c=AMBER, w=9, h=11):
    """要確認は文字の右に書類のアイコン。押すとその成果物へ飛ぶ（メンバー画面と同じ作法）"""
    return ('<span style="width:%dpx;height:%dpx;border:1px solid %s;border-radius:2px;'
            'flex-shrink:0;display:inline-block"></span>' % (w, h, c))

PRODUCE_C = {
    '統括AI':  lambda: (mono('AIが決めた 12  ·  あなたが 2', T5), ''),
    '調査担当': lambda: (sq_run(12, 8, CYAN),      '事実 34'),
    '戦略担当': lambda: (text_lines(PURPLE, (40, 33, 22)), '1,248字'),
    '開発担当': lambda: (dot_run(18, 18, AGREEN),  'テスト 24'),
    '企画担当': lambda: (week_cells(4, 1, INDIGO), '1 / 4週'),
}

def deskcard(name, key, state, spec, now, el, done, running, total, log, first=False):
    """1人ぶんを縦に積む。**5段**（誰 / どんな設定で / いま何を / 工程 / 出したもの）"""
    sc = STATE_C[state]
    fig, cap = PRODUCE_C[name]()
    w = WAIT[name]
    return ('<div style="%sdisplay:flex;flex-direction:column;gap:8px;min-width:0">'
            % ('width:186px;flex:0 0 186px;' if first
               else 'flex:0 0 186px;border-left:1px solid %s;padding-left:20px;box-sizing:content-box;' % HAIR)
            # 誰
            + '<div style="display:flex;align-items:center;gap:8px;height:26px">'
              + orb(RGB[key], 26) + '<span style="font-size:13px">%s</span>' % name
            + '</div>'
            # どんな設定で動いているか（状態 ＋ モデル ＋ 深さ）
            + '<div style="display:flex;align-items:center;gap:6px;height:14px">'
              + dot(sc[0], 5)
              + '<span style="color:%s;font-size:10.5px">%s</span>' % (sc[1], state)
              + (doc_icon() if state == '要確認' else '')
              + '<span style="color:%s;font-size:10.5px">·  %s</span>' % (T5, spec.replace(' · ', ' · '))
            + '</div>'
            # いま何をしているか
            + '<div style="display:flex;align-items:baseline;gap:8px;height:17px">'
              + '<span style="color:%s;font-size:12px;overflow:hidden;text-overflow:ellipsis;'
                'white-space:nowrap">%s</span><div style="flex:1"></div>%s'
                % (T2, now, mono(el, T5) if el else '')
            + '</div>'
            # 工程（run_steps を1本に畳む）
            + '<div style="display:flex;align-items:center;gap:9px;height:14px">'
              + steps(done, running, total, HEX[key], 76)
              + '<span style="color:%s;font-size:10.5px;white-space:nowrap;overflow:hidden;'
                'text-overflow:ellipsis">%d / %d · %s</span>' % (T5, done, total, STEPNAME[name])
            + '</div>'
            # 出したもの（器は produces で決まる）＋ このあと積まれているぶん
            + '<div style="display:flex;align-items:center;gap:9px;height:13px">'
              + fig + (mono(cap) if cap else '') + '<div style="flex:1"></div>'
              + (mono('待ち %d' % w, T5) if w else '')
            + '</div></div>')

b3 = ('<div style="position:relative;padding:16px 30px 0;display:flex;flex-direction:column;gap:20px">'
  # いちばん上: ホームの4ビュー切替
  + pills('オフィス')
  # 絵とログ。**答えの一文も上の帯も置かない**（数は絵と社員の行が言っている）
  + '<div style="display:flex;gap:22px;align-items:stretch">'
    + '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">%s</div>'
      % fig_rings(810, 404)
    + logcol(len(FEED_A3), h=378)
  + '</div>'
  # 下: 社員。**入力欄のぶん逃がす**
  + '<div style="border-top:1px solid %s;padding-top:12px;margin-bottom:%dpx">' % (HAIR, COMPOSER_NOTE)
    + '<div style="display:flex;align-items:baseline;padding-bottom:10px">'
      '<span style="color:%s;font-size:11px">AI社員</span><div style="flex:1"></div>'
      '<span style="color:%s;font-size:10.5px" class="tnum">4人  ·  稼働 4 / 4</span></div>' % (T5, T5)
    # **人が増えたら横にスクロール**。1人ぶんの幅は縮めない
    + '<div class="sx" style="display:flex;gap:20px;align-items:flex-start;padding-bottom:6px">'
      + ''.join(deskcard(*m, first=(i == 0)) for i, m in enumerate(REAL))
    + '</div>'
  + '</div>'
  + composer()
  + '</div>')
io.open(OUT + '/LayoutTeamBottom.dc.html', 'w', encoding='utf-8').write(
    board('絵とログが上、社員は下に5列', '③ 下に社員', b3, GREEN_T,
          '下の空きは入力欄が浮く場所 · 統括AI は左に分けて置く'))
print('L3 ok')

io.open(OUT + '/FigureRiver.dc.html', 'w', encoding='utf-8').write(
    figboard('横がフェーズ。道の上に社員が立つ', '図B 川', '進捗のガントと形が似る', fig_river()))
print('FigB ok')
io.open(OUT + '/FigureFan.dc.html', 'w', encoding='utf-8').write(
    figboard('中心から外へ。外の弧に届いたら完了', '図A 扇', '3本より増えると角度が窮屈', fig_fan()))
print('FigA ok')
io.open(OUT + '/FigureRings.dc.html', 'w', encoding='utf-8').write(
    figboard('輪はそのまま。色の変わり目が引き継ぎ ＝ フェーズの境目', '図C 輪（採用）',
             '刻みは置かない · 色が変わるところが境目', fig_rings(), GREEN_T))
print('FigC ok')

# ══════════════════════ 図の意味の台帳 ══════════════════════
NONE = '意味なし'

MEAN = [
  ('中心にあるもの',   '統括AI',            '統括AI（仕事が生まれるところ）', '統括AI（左端が源）',      '統括AI'),
  ('中心からの距離',   NONE + '（重ねる順だけ）', '完成にどれだけ近いか',    '—',                      NONE + '（重ねる順だけ）'),
  ('角度 / 縦の位置',  '進んだ割合',        'どの Work か',                'どの Work か',            '進んだ割合'),
  ('道の長さ',         '進んだ割合',        '進んだ割合',                  '進んだ割合',              '進んだ割合'),
  ('道の色',           'その区間をやった人', 'その区間をやった人',          'その区間をやった人',      'その区間をやった人'),
  ('色の変わり目',     '引き継ぎ',          '引き継ぎ ＝ フェーズの境目',   '引き継ぎ ＝ フェーズの境目', '引き継ぎ ＝ フェーズの境目'),
  ('先端の尾',         'いま動いているところ', 'いま動いているところ',      '—（球が先端に立つ）',      'いま動いているところ'),
  ('目盛り',           '無い',              'フェーズの境目',              'フェーズの境目 ＋ 名前',   'フェーズの境目'),
  ('赤い点線',         '予定との差',        '予定との差',                  '予定との差',              '予定との差'),
  ('橙の菱形',         'あなたが決めるところ', 'あなたが決めるところ',      'あなたが決めるところ',    'あなたが決めるところ'),
  ('球の位置',         'その人の区間のまん中', 'いるフェーズ',              'いるフェーズ',            'いるフェーズ'),
  ('球の大きさ',       NONE,                NONE + '（わざと）',           NONE + '（わざと）',       NONE + '（わざと）'),
  ('外の縁 / 右の端',  NONE,                '完了',                        '完了',                    NONE),
]

QMAP = [
  ('誰から誰に渡ったか',   '道の色が変わるところ。変わり目に時計回りの矢羽根が立つ'),
  ('どのくらい進んでいるか', '道の長さ。A は中心からの距離、B は左からの距離、C は弧の角度'),
  ('どのフェーズに誰がいるか', '球が立っている区間。境目の目盛りと、先頭の球の下のフェーズ名'),
]

def m_cell(t, w):
    c = RED_T if t.startswith(NONE) else (T2 if t not in ('—', '無い') else T5)
    return ('<span style="width:%dpx;flex-shrink:0;color:%s;font-size:11.5px;line-height:18px">%s</span>'
            % (w, c, t))

mean_body = ('<div style="padding:22px 30px 30px;display:flex;flex-direction:column;gap:26px">'
  '<span style="color:%s;font-size:13.5px;line-height:22px;max-width:960px">'
  '図に置いてあるもの全部に、意味があるかどうかを書き出しました。'
  'いまの図で<b style="color:%s">何も言っていないのは3つ</b> — '
  '中心からの距離・球の大きさ・外の縁。ここに意味を入れると、'
  '「誰から誰に / どのくらい / どのフェーズに誰が」が図だけで読めます。</span>' % (T2, RED_T) +

  '<div>'
    '<span style="display:block;color:%s;font-size:11px;padding-bottom:10px">'
    '聞きたいこと3つは、どの要素が答えるか</span>' % T5
    + ''.join('<div class="r" style="display:flex;gap:16px;padding:11px 0">'
              '<span style="width:200px;flex-shrink:0;font-size:13px">%s</span>'
              '<span style="flex:1;color:%s;font-size:12.5px;line-height:20px">%s</span></div>' % (q, T2, a)
              for q, a in QMAP)
  + '</div>'

  '<div style="height:1px;background:%s"></div>' % HAIR +

  '<div>'
    '<div style="display:flex;gap:14px;padding-bottom:8px">'
      '<span style="width:118px;flex-shrink:0;color:%s;font-size:11px">図の要素</span>'
      '<span style="width:216px;flex-shrink:0;color:%s;font-size:11px">いまの図</span>'
      '<span style="width:216px;flex-shrink:0;color:%s;font-size:11px">A 扇</span>'
      '<span style="width:216px;flex-shrink:0;color:%s;font-size:11px">B 川</span>'
      '<span style="width:216px;flex-shrink:0;color:%s;font-size:11px">C 輪＋刻み</span>'
    '</div>' % (T5, T5, BLUE_T, BLUE_T, BLUE_T)
    + ''.join('<div class="r" style="display:flex;gap:14px;padding:10px 0">'
              '<span style="width:118px;flex-shrink:0;font-size:12px">%s</span>%s%s%s%s</div>'
              % (r[0], m_cell(r[1], 216), m_cell(r[2], 216), m_cell(r[3], 216), m_cell(r[4], 216))
              for r in MEAN)
  + '</div>'

  '<span style="color:%s;font-size:12px;line-height:20px;max-width:960px">'
  '球の大きさは<b style="color:%s">わざと意味を持たせません</b>。'
  '大きさに意味を入れると、小さい球が「重要ではない社員」に見えてしまう。'
  'AI社員は増やしたり止めたりするもので、序列をつけるものではないので。</span>' % (T5, T2) +
  '</div>')

io.open(OUT + '/Meaning.dc.html', 'w', encoding='utf-8').write(
    board('図の要素と、その意味', '④ 意味の棚卸し', mean_body, T3))
print('Meaning ok')

# ══════════════════════ ワークフロー（Figma のように画面いっぱい） ══════════════════════
# **盤面を 1148×760 の箱に収めるのをやめる。** 中身の領域いっぱいに広げて、
# ピル・ツールバー・ミニマップ・入力欄は全部その上に浮かせる。
# 「入る大きさに縮める」も要らなくなる（無限のキャンバスなので、拡大率は自分で決める）。
GW2, GH2 = 1180, 782
NH2, CW2, RW2 = 66, 176, 172
CX2 = [40, 268, 496, 724]
ROW2 = 330
RX2 = 976
RY2 = [150, 330, 510]
CANV = '#060606'

# 左3pxの色帯は**進捗のガントと同じ読み方**にする —
#   済＝暗い / いま＝明るい / これから＝点線 / あなたの番＝橙。
#   前は完了が緑だったが、緑は社員の「実行中」でも使っていて読み方が2つあった
NSKIN = {
  'done': ('#0B0B0B', '1px solid #1D1D1D', '#2A2A2A', T2, T5),
  'now':  ('#101010', '1px solid #333333', T2,        T1, T4),
  'gate': ('rgba(227,116,0,0.05)', '1px solid rgba(227,116,0,0.28)', AMBER, T1, AMBER_T),
  'wait': ('#080808', '1px dashed #1F1F1F', '#141414', T4, T5),
  'work': ('#0C0C0C', '1px solid #272727', '#2E2E2E', T2, T5),
}

def node(x, y, w, title, sub, kind, h=None):
    h = h or NH2
    bg, bd, bar, tc, sc = NSKIN[kind]
    out = ('<div style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx;box-sizing:border-box;'
           'display:flex;align-items:center;padding:0 14px 0 15px;border-radius:14px;background:%s;'
           'border:%s;overflow:hidden;">'
           '<span style="position:absolute;left:0;top:11px;bottom:11px;width:3px;border-radius:0 2px 2px 0;'
           'background:%s"></span>'
           '<div style="min-width:0;display:flex;flex-direction:column;gap:3px">'
           '<span style="color:%s;font-size:14px;line-height:19px;white-space:nowrap;overflow:hidden;'
           'text-overflow:ellipsis">%s</span>'
           '<span style="color:%s;font-size:11px;line-height:15px;white-space:nowrap">%s</span>'
           '</div></div>' % (x, y, w, h, bg, bd, bar, tc, title, sc, sub))
    return out

def port(x, y, on=False):
    return ('<div style="position:absolute;left:%.1fpx;top:%.1fpx;width:9px;height:9px;box-sizing:border-box;'
            'border-radius:999px;background:%s;border:1.5px solid %s"></div>'
            % (x - 4.5, y - 4.5, CANV, '#4E4E4E' if on else '#2E2E2E'))

def elabel(x, y, t):
    return ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;transform:translate(-50%%,-50%%);'
            'padding:0 5px;color:%s;font-size:11px;white-space:nowrap;background:%s">%s</div>'
            % (x, y, T5, CANV, t))

def subport(x, top, label):
    return ('<div style="position:absolute;left:%dpx;top:%dpx;width:1px;height:15px;background:#262626"></div>'
            '<div style="position:absolute;left:%.1fpx;top:%dpx;width:21px;height:21px;box-sizing:border-box;'
            'border-radius:999px;background:#131313;border:1px solid #2E2E2E;display:flex;align-items:center;'
            'justify-content:center">%s</div>'
            '<div style="position:absolute;left:%dpx;top:%dpx;transform:translateX(-50%%);color:%s;'
            'font-size:11px;white-space:nowrap">%s</div>'
            % (x, top, x - 10.5, top + 15, icon('plus', T4, 11), x, top + 41, T5, label))

def tool(n, on=False):
    return ('<span style="width:28px;height:28px;border-radius:7px;display:inline-flex;align-items:center;'
            'justify-content:center;%s">%s</span>'
            % ('background:#262626;' if on else '', icon(n, T1 if on else '#8B8B8B', 15, 1.7)))

def workflow():
    mid = ROW2 + NH2 / 2
    rowc = [y + NH2 / 2 for y in RY2]
    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="position:absolute;inset:0">' % (GW2, GH2, GW2, GH2)]
    def edge(x1, y1, x2, y2, dash=False):
        return ('<path d="M %.1f %.1f C %.1f %.1f, %.1f %.1f, %.1f %.1f" fill="none" stroke="#282828" '
                'stroke-width="1.3"%s/>'
                % (x1, y1, x1 + 30, y1, x2 - 30, y2, x2, y2, ' stroke-dasharray="4 4"' if dash else ''))
    for i in range(3):
        g.append(edge(CX2[i] + CW2, mid, CX2[i + 1], mid))
    for i, y in enumerate(rowc):
        g.append(edge(CX2[3] + CW2, mid, RX2, y, i == 1))
    # 右の端で切れずに続く（無限のキャンバスであることを、絵のほうで言う）
    for y in [rowc[0], rowc[2]]:
        g.append(edge(RX2 + RW2, y, GW2 + 24, y, True))
    g.append('</svg>')
    h = ''.join(g)

    CHAIN = [('調査', 'フェーズ 1 · 完了', 'done'), ('戦略', 'フェーズ 2 · 実行中 32%', 'now'),
             ('収益モデル比較', '成果物 · 要確認', 'gate'), ('価格モデル', '判断 · B案を推奨', 'gate')]
    RIGHT = [('LPと申込フォーム', '新しい Work · 準備中', 'work', '新しい Work'),
             ('プロダクト', 'フェーズ 3 · 待機', 'wait', '次のフェーズ'),
             ('SNS運用の立ち上げ', '新しい Work · 準備中', 'work', '新しい Work')]
    for i, (t, sb, k) in enumerate(CHAIN):
        h += node(CX2[i], ROW2, CW2, t, sb, k)
    for i, (t, sb, k, _) in enumerate(RIGHT):
        h += node(RX2, RY2[i], RW2, t, sb, k)
    for i, x in enumerate(CX2):
        if i:
            h += port(x, mid, True)
        h += port(x + CW2, mid, True)
    for y in rowc:
        h += port(RX2, y) + port(RX2 + RW2, y)
    for i, (_, _, _, lab) in enumerate(RIGHT):
        h += elabel(RX2 - 30, (mid + rowc[i]) / 2 + (12 if i == 1 else -12), lab)
    for i, lab in enumerate(['担当 2', '成果物 1']):
        h += subport(CX2[1] + 50 + i * 76, ROW2 + NH2, lab)

    # ── 上に浮くもの ──
    h += ('<div style="position:absolute;left:24px;top:26px;color:%s;font-size:12px">日本語学習サービス</div>' % T4)
    h += '<div style="position:absolute;left:0;right:0;top:18px">%s</div>' % pills('ワークフロー')
    # 左下 ＝ ツールバー。**中央下は入力欄がいるので譲る**。
    # 「収める」ボタンは置かず、数字を押すと 100% に戻す（オフィスの盤面と同じ作法）
    h += ('<div style="position:absolute;left:24px;bottom:24px;display:flex;align-items:center;gap:3px;'
          'padding:5px 7px;border-radius:12px;background:#121212;border:1px solid #2A2A2A">'
          + tool('cursor', True) + tool('hand')
          + '<span style="width:1px;height:18px;background:#262626;margin:0 4px"></span>'
          + tool('minus')
          + '<span style="color:%s;font-size:12px;padding:0 4px" class="tnum">100%%</span>' % T2
          + tool('plus') + '</div>')
    # 右下 ＝ ミニマップ
    mm = ''.join('<div style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx;border-radius:2px;'
                 'background:%s"></div>' % v for v in
                 [(10, 34, 24, 9, '#232323'), (40, 34, 24, 9, '#3A3A3A'), (70, 34, 22, 9, '#232323'),
                  (98, 34, 22, 9, 'rgba(227,116,0,0.55)'), (124, 16, 16, 8, '#2A2A2A'),
                  (124, 34, 16, 8, '#1E1E1E'), (124, 52, 16, 8, '#2A2A2A')])
    h += ('<div style="position:absolute;right:24px;bottom:24px;width:148px;height:84px;border-radius:10px;'
          'background:#0A0A0A;border:1px solid %s;overflow:hidden">%s'
          '<div style="position:absolute;left:4px;top:20px;width:96px;height:44px;border-radius:5px;'
          'border:1px solid #4A4A4A;background:rgba(255,255,255,0.03)"></div></div>' % (LINE, mm))
    h += composer()

    return ('<div style="position:relative;width:%dpx;height:%dpx;overflow:hidden;background:%s;'
            'background-image:radial-gradient(#161616 1px, transparent 1px);background-size:22px 22px">'
            '%s</div>' % (GW2, GH2, CANV, h))

io.open(OUT + '/Workflow.dc.html', 'w', encoding='utf-8').write(
    board('画面いっぱい。青い輪はやめた', 'ワークフロー 1', workflow(), BLUE_T,
          '色帯は 済＝暗い / いま＝明るい / これから＝点線 に揃えた'))
print('Workflow ok')

# ══════════════════════ ワークフロー 2（会社ぜんぶ・成果物と判断はぶら下げる） ══════════════════════
# 直したこと
#  1. **1つの Work だけでなく、会社ぜんぶを1枚に。** ほかの3ビューと同じ単位にそろえる
#  2. **背骨はフェーズだけ。** 成果物と判断は、それが属するフェーズの下にぶら下げる
#     （前は 調査 → 戦略 → 収益モデル比較 → 価格モデル と横一列で、
#      成果物や判断がフェーズと同じ「順番のもの」に見えていた）
#  3. **横位置＝時間。** 枝分かれした Work は、生まれたフェーズの位置から始める
#  4. ポートは**繋がっているところだけ**。⊕ は押せるものだけ（採用に飛ぶ「担当」だけ残す）
#  5. ミニマップは**中身が窓より大きいときだけ**出す（いまは全部入っているので出さない）

CW3, NH3 = 170, 66
GAP3 = 48
COL3 = [140, 358, 576, 794]
CHW, CHH = 158, 46

def chip(x, y, title, sub, kind):
    return node(x, y, CHW, title, sub, kind, h=CHH)

def crew(x, y, w, h, keys):
    """そのフェーズに**いま誰がいるか**。⊕ で足すものではないので、粒をそのまま置く"""
    out = ''
    for i, k in enumerate(reversed(keys)):
        out += ('<div style="position:absolute;left:%.0fpx;top:%.0fpx;display:flex">%s</div>'
                % (x + w - 16 - i * 12 - 9, y + h / 2 - 9, orb(RGB[k], 18)))
    return out

def workflow2():
    gw, gh = 1180, 782
    R1, R2, R3 = 110, 330, 500
    cy = lambda y: y + NH3 / 2
    g = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" style="position:absolute;inset:0">' % (gw, gh, gw, gh)]
    def bez(x1, y1, x2, y2, dash=False, c1=None, c2=None):
        a = c1 or (x1 + 30, y1)
        b = c2 or (x2 - 30, y2)
        return ('<path d="M %.1f %.1f C %.1f %.1f, %.1f %.1f, %.1f %.1f" fill="none" stroke="#282828" '
                'stroke-width="1.3"%s/>' % (x1, y1, a[0], a[1], b[0], b[1], x2, y2,
                                            ' stroke-dasharray="4 4"' if dash else ''))
    ROWS = [
      (R1, '日本語学習サービス', 0,
       [('調査', 'フェーズ 1 · 完了', 'done'), ('戦略', 'フェーズ 2 · 実行中 32%', 'now'),
        ('プロダクト', 'フェーズ 3 · 待機', 'wait'), ('ローンチ', 'フェーズ 4 · 待機', 'wait')]),
      (R2, 'SNS運用の立ち上げ', 1,
       [('準備', 'フェーズ 1 · 完了', 'done'),
        ('運用設計', 'フェーズ 2 · 実行中 <span style="color:%s">遅れ 2日</span>' % RED_T, 'now'),
        ('運用', 'フェーズ 3 · 待機', 'wait')]),
      (R3, 'LPと申込フォーム', 1,
       [('設計', 'フェーズ 1 · 完了', 'done'), ('制作', 'フェーズ 2 · 実行中 61%', 'now'),
        ('公開', 'フェーズ 3 · 待機', 'wait')]),
    ]
    # 背骨の線
    for y, name, off, ph in ROWS:
        for i in range(len(ph) - 1):
            g.append(bez(COL3[off + i] + CW3, cy(y), COL3[off + i + 1], cy(y)))
    # 統括AI → いちばん上の Work
    g.append(bez(84, 391, COL3[0] - 9, cy(R1), False, (112, 391), (112, cy(R1))))
    # 枝分かれ。**生まれたフェーズの位置から始める**ので、左→右の向きは壊れない
    for y in (R2, R3):
        g.append(bez(COL3[1] + 24, R1 + NH3, COL3[1] - 9, cy(y), True,
                     (318, R1 + NH3 + 70), (318, cy(y) - 60)))
    # 成果物と判断は、属するフェーズの下にぶら下げる
    for px, py, cxs, ty in [(COL3[1], R1, [COL3[1], COL3[1] + CHW + 12], 214),
                            (COL3[1] + 0, R3, [], 0)]:
        for c in cxs:
            g.append(bez(px + CW3 / 2, py + NH3, c + CHW / 2, ty, False,
                         (px + CW3 / 2, py + NH3 + 22), (c + CHW / 2, ty - 22)))
    g.append(bez(COL3[2] + CW3 / 2, R3 + NH3, COL3[2] + CW3 / 2, 592, False,
                 (COL3[2] + CW3 / 2, R3 + NH3 + 16), (COL3[2] + CW3 / 2, 576)))
    g.append('</svg>')
    h = ''.join(g)

    for y, name, off, ph in ROWS:
        h += ('<div style="position:absolute;left:%dpx;top:%dpx;color:%s;font-size:12px;'
              'white-space:nowrap">%s</div>' % (COL3[off], y - 24, T3, name))
        for i, (t, sb, k) in enumerate(ph):
            h += node(COL3[off + i], y, CW3, t, sb, k)
        for i in range(len(ph)):
            if off + i:
                h += port(COL3[off + i], cy(y), True)
            if i < len(ph) - 1:
                h += port(COL3[off + i] + CW3, cy(y), True)
    h += chip(COL3[1], 214, '収益モデル比較', '成果物 · 要確認', 'gate')
    h += chip(COL3[1] + CHW + 12, 214, '価格モデル', '判断 · あなたの番', 'gate')
    h += chip(COL3[2], 592, '申込フォーム', '成果物 · 実行中', 'work')
    # そのフェーズにいる社員は、ノードの右に粒で置く（⊕ で足すものではない）
    h += crew(COL3[1], R1, CW3, NH3, ['cyan', 'purple'])
    h += crew(COL3[2], R2, CW3, NH3, ['indigo'])
    h += crew(COL3[2], R3, CW3, NH3, ['green'])
    h += elabel(318, (R1 + NH3 + cy(R2)) / 2, '新しい Work')

    h += ('<div style="position:absolute;left:24px;top:26px;color:%s;font-size:12px">3つの Work</div>' % T4)
    h += '<div style="position:absolute;left:0;right:0;top:18px">%s</div>' % pills('ワークフロー')
    h += ('<div style="position:absolute;left:%dpx;top:%dpx;transform:translate(-50%%,-50%%);'
          'display:flex;flex-direction:column;align-items:center;gap:6px">'
          '%s<span style="color:#E8E8E8;font-size:11.5px">統括AI</span></div>'
          % (56, 391, orb(RGB['white'], 44, glow=.5)))
    h += ('<div style="position:absolute;left:24px;bottom:24px;display:flex;align-items:center;gap:3px;'
          'padding:5px 7px;border-radius:12px;background:#121212;border:1px solid #2A2A2A">'
          + tool('cursor', True) + tool('hand')
          + '<span style="width:1px;height:18px;background:#262626;margin:0 4px"></span>'
          + tool('minus')
          + '<span style="color:%s;font-size:12px;padding:0 4px" class="tnum">100%%</span>' % T2
          + tool('plus') + '</div>')
    h += composer()
    return ('<div style="position:relative;width:%dpx;height:%dpx;overflow:hidden;background:%s;'
            'background-image:radial-gradient(#161616 1px, transparent 1px);background-size:22px 22px">'
            '%s</div>' % (gw, gh, CANV, h))

io.open(OUT + '/WorkflowAll.dc.html', 'w', encoding='utf-8').write(
    board('会社ぜんぶ。背骨はフェーズだけ', 'ワークフロー 2', workflow2(), GREEN_T,
          '成果物と判断は属するフェーズの下 · 枝は生まれた位置から'))
print('Workflow2 ok')

# ══════════════════════ canvas.json ══════════════════════
import json
canvas = {
  "artboards": [
    # 上の段 = いまの検討（CPU を出すか、正直な計器にするか）
    {"file": "Main.dc.html",     "x": 0,    "y": 0,    "w": 1180, "h": 770, "title": "① 診断"},
    {"file": "Numbers.dc.html",  "x": 1300, "y": 0,    "w": 1180, "h": 910, "title": "② その数字はどこから来るか"},
    {"file": "OptionA1.dc.html", "x": 2600, "y": 0,    "w": 1180, "h": 960, "title": "A1 実機（CPU をそのまま）"},
    {"file": "OptionA2.dc.html", "x": 3900, "y": 0,    "w": 1180, "h": 960, "title": "A2 正直な計器"},
    # 下の段 = 先に見せた3案（A を選んでもらった。B / C は記録として残す）
    {"file": "OptionA.dc.html",  "x": 0,    "y": 1120, "w": 1180, "h": 730, "title": "A 計器盤（採用）"},
    {"file": "OptionB.dc.html",  "x": 1300, "y": 1120, "w": 1180, "h": 780, "title": "B 濃い盤面"},
    {"file": "OptionC.dc.html",  "x": 2600, "y": 1120, "w": 1180, "h": 800, "title": "C 一気見の表"},
    # 3段目 = 参考4枚の計器を1つずつ見た結果
    {"file": "Params.dc.html",   "x": 0,    "y": 2050, "w": 1180, "h": 1560, "title": "③ 4枚の計器を1つずつ"},
    {"file": "OptionA3.dc.html", "x": 1300, "y": 2050, "w": 1180, "h": 810,  "title": "A3 採用ぶんを入れた"},
    # 4段目 = 答えの一文をやめたあとの置き場所（社員とログをどこに置くか）
    {"file": "LayoutSides.dc.html",     "x": 0,    "y": 3750, "w": 1180, "h": 800, "title": "① 左右"},
    {"file": "LayoutLogBottom.dc.html", "x": 1300, "y": 3750, "w": 1180, "h": 900, "title": "② 下にログ"},
    {"file": "LayoutTeamBottom.dc.html","x": 2600, "y": 3750, "w": 1180, "h": 860, "title": "③ 下に社員（採用）"},
    {"file": "LayoutOneColumn.dc.html", "x": 3900, "y": 3750, "w": 1180, "h": 860, "title": "④ 右に1本"},
    # 5段目 = 図の作り直し（要素を全部意味のあるものにする）
    {"file": "Meaning.dc.html",      "x": 0,    "y": 4790, "w": 1180, "h": 980, "title": "④ 図の意味の棚卸し"},
    {"file": "FigureFan.dc.html",    "x": 1300, "y": 4790, "w": 1180, "h": 580, "title": "図A 扇"},
    {"file": "FigureRiver.dc.html",  "x": 2600, "y": 4790, "w": 1180, "h": 580, "title": "図B 川"},
    {"file": "FigureRings.dc.html",  "x": 3900, "y": 4790, "w": 1180, "h": 580, "title": "図C 輪＋刻み"},
    # 6段目 = ワークフロー
    {"file": "Workflow.dc.html",    "x": 0,    "y": 5910, "w": 1180, "h": 860, "title": "ワークフロー 1（いまの形）"},
    {"file": "WorkflowAll.dc.html", "x": 1300, "y": 5910, "w": 1180, "h": 860, "title": "ワークフロー 2（会社ぜんぶ）"},
  ],
  "launch": {"view": "canvas"},
}
io.open(OUT + '/canvas.json', 'w', encoding='utf-8').write(json.dumps(canvas, ensure_ascii=False, indent=2))
print('canvas ok')
