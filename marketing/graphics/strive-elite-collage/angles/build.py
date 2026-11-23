"""Writes the 5v5 co-post carousel, Maryland vs Virginia
(01.html to 08.html; Coach Yinka Nov 22 and 23). Render each with
node ../render.mjs 2 NN.png angles/NN.html from the folder above."""
HEAD = """<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"><style>{css}</style></head>
<body><div class="stage">{bg}<div class="vig"></div>
<div class="eyebrow" style="font-size:19px;letter-spacing:7px">STRIVE ELITE 5V5<i>•</i>MARYLAND VS VIRGINIA</div>
{body}
{foot}
<img class="logo" src="../strive-logo-512.png"><div class="grain"></div></div></body></html>"""
STAD = '<img class="bg" src="../stadium/stadium-dark.png">'
VA = ''.join(f'<img class="p" src="../cutouts3/{f}" style="{s}">' for f, s in [
  ('b3.png', 'left:600px;top:560px;height:520px;z-index:3'),
  ('b5.png', 'left:270px;top:610px;height:560px;z-index:4'),
  ('b2.png', 'left:820px;top:640px;height:500px;z-index:5;filter:drop-shadow(0 18px 24px rgba(0,0,0,.75)) contrast(1.08) brightness(1.3)'),
  ('b4n.png', 'left:20px;top:690px;height:500px;z-index:6'),
])
MD = ''.join(f'<img class="p" src="../cutouts4/{f}" style="{s}">' for f, s in [
  ('m1.png', 'left:640px;top:560px;height:520px;z-index:3'),
  ('m5.png', 'left:60px;top:640px;height:500px;z-index:4'),
  ('../cutouts3/b1.png', 'left:420px;top:600px;height:560px;z-index:5'),
  ('m2.png', 'left:230px;top:650px;height:560px;z-index:6'),
  ('m4.png', 'left:810px;top:690px;height:500px;z-index:6'),
])
MD = MD.replace('../cutouts4/../cutouts3', '../cutouts3')

pages = {}

SPLIT_CSS = """
.mdside{position:absolute;inset:0;z-index:1;clip-path:polygon(0 0,{tx}px 0,{bx}px 1350px,0 1350px);
 background:url(mdflag.svg) {fx}px {fy}px/{fw}px auto no-repeat;filter:brightness(.42) saturate(.9)}
.vaside{position:absolute;inset:0;z-index:1;clip-path:polygon({tx}px 0,1080px 0,1080px 1350px,{bx}px 1350px);
 background:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 2px,transparent 2px 26px),
 radial-gradient(ellipse 70% 60% at 75% 45%,#1d4a9e 0%,#0b2a66 45%,#03102b 100%)}
.seam{position:absolute;inset:0;z-index:2;background:linear-gradient(transparent,transparent);
 clip-path:polygon({tx}px 0,{tx2}px 0,{bx2}px 1350px,{bx}px 1350px);background:linear-gradient(180deg,#fff6d8,#c8a858 50%,#8a6420)}
.side{position:absolute;z-index:6;font-family:'Oswald',sans-serif;font-weight:700;letter-spacing:6px;text-transform:uppercase;
 -webkit-text-stroke:2px rgba(255,255,255,.55);color:transparent;line-height:1}
.topshade{position:absolute;left:0;right:0;top:0;height:560px;z-index:3;background:linear-gradient(180deg,rgba(3,3,3,.92) 0%,rgba(3,3,3,.75) 55%,rgba(3,3,3,0) 100%)}
.bust{-webkit-mask-image:linear-gradient(180deg,#000 80%,transparent 99%);mask-image:linear-gradient(180deg,#000 80%,transparent 99%)}
.vs{position:absolute;z-index:26;font-family:'Oswald',sans-serif;font-weight:700;font-size:210px;line-height:1;
 background:linear-gradient(180deg,#fff6d8 0%,#efd287 40%,#c39a3c 80%,#8a6420 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
 filter:drop-shadow(0 0 30px rgba(232,190,90,.45)) drop-shadow(0 10px 20px rgba(0,0,0,.95))}
"""
def split_css(tx, bx, fx=-60, fy=0, fw=1500):
    return (SPLIT_CSS.replace('{tx2}', str(tx+6)).replace('{bx2}', str(bx+6))
            .replace('{tx}', str(tx)).replace('{bx}', str(bx))
            .replace('{fx}', str(fx)).replace('{fy}', str(fy)).replace('{fw}', str(fw)))
SPLIT = '<div class="mdside"></div><div class="vaside"></div><div class="seam"></div>'

pages['01'] = dict(bg='', css=split_css(640, 440, fx=-120, fy=-40, fw=2100), body=f"""{SPLIT}
<div class="big white" style="top:118px;font-size:122px;white-space:nowrap">WALK IN YO TRAP.</div>
<div class="big gold" style="top:236px;font-size:122px;white-space:nowrap">TAKE OVER YO TRAP.</div>
<div class="side" style="left:40px;top:395px;font-size:66px">MARYLAND</div>
<div class="side" style="right:40px;top:395px;font-size:66px;text-align:right">VIRGINIA</div>
<div class="topshade"></div>
<img class="p bust" src="../cutouts4/m1.png" style="left:-70px;top:480px;height:620px;z-index:4">
<img class="p" src="../cutouts4/m2.png" style="left:150px;top:545px;height:620px;z-index:7">
<img class="p bust" src="../cutouts3/b3.png" style="left:600px;top:470px;height:620px;z-index:4">
<img class="p" src="../cutouts3/b4n.png" style="left:510px;top:670px;height:495px;z-index:7">
<div class="vs" style="left:428px;top:600px">VS</div>
<div class="fade" style="height:200px;z-index:20;background:linear-gradient(to bottom,rgba(5,5,5,0),rgba(5,5,5,.9) 55%)"></div>
<div class="line" style="top:1195px;font-size:30px;font-weight:600;letter-spacing:4px;z-index:25">VIRGINIA IS PULLING UP TO MARYLAND. DEC 21.</div>
""")

pages['02'] = dict(bg='<div class="mdfull"></div><div class="tshade"></div>', css="", body=f"""
<div class="big white" style="top:125px;font-size:118px">IT'S IN YOUR</div>
<div class="big gold" style="top:228px;font-size:168px">BACKYARD,</div>
<div class="big white" style="top:375px;font-size:118px">MARYLAND.</div>
<div class="line" style="top:500px;font-size:30px;letter-spacing:1px">Home field. Home crowd. <b style="color:#efd287">No excuses.</b></div>
{MD}<div class="fade"></div>""")

pages['03'] = dict(bg='<div class="mdfull"></div>', css="""
.poster{position:absolute;left:150px;top:120px;width:780px;height:1000px;z-index:10;
 background:radial-gradient(ellipse at 50% 40%,#e9d7a6 0%,#d8bf83 55%,#a88a4e 100%);
 box-shadow:0 40px 80px rgba(0,0,0,.85),inset 0 0 120px rgba(90,60,20,.55);transform:rotate(-1.5deg)}
.poster:before{content:"";position:absolute;inset:22px;border:3px solid #3a2a12;opacity:.8}
.pin{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff3c4,#c49a3a 60%,#5a400f);box-shadow:0 4px 6px rgba(0,0,0,.6);z-index:11}
.w{position:absolute;left:0;right:0;text-align:center;font-family:'Oswald',sans-serif;font-weight:700;color:#2a1d0a;text-transform:uppercase}
.sil{position:absolute;left:240px;top:280px;width:300px;height:330px;background:#2a1d0a;opacity:.9;
 -webkit-mask:url(../cutouts3/b4n.png) center/contain no-repeat;mask:url(../cutouts3/b4n.png) center/contain no-repeat}
.q{position:absolute;left:0;right:0;top:350px;text-align:center;font-family:'Oswald',sans-serif;font-weight:700;font-size:200px;color:#d8bf83;opacity:.0}
""", body="""
<div class="poster">
 <div class="w" style="top:50px;font-size:170px;letter-spacing:10px">WANTED</div>
 <div class="w" style="top:262px;font-size:30px;letter-spacing:4px">ONE MARYLAND TEAM THAT CAN HANG</div>
 <div style="position:absolute;left:230px;top:318px;width:320px;height:320px;border:3px solid #2a1d0a;background:rgba(42,29,10,.12)"></div>
 <div class="w" style="top:345px;font-size:230px;line-height:1;opacity:.85">?</div>
 <div class="w" style="top:665px;font-size:38px;letter-spacing:10px">REWARD</div>
 <div class="w" style="top:705px;font-size:150px;line-height:1.05">$3,000</div>
 <div class="w" style="top:880px;font-family:Inter;font-weight:600;font-size:24px;letter-spacing:1px;text-transform:none;font-style:italic">Last seen talking big in the group chat.</div>
</div>
<div class="pin" style="left:178px;top:140px"></div><div class="pin" style="left:880px;top:122px"></div>
""")

pages['04'] = dict(bg='<div class="mdfull"></div><div class="tshade"></div>', css="""
.bub{position:absolute;z-index:14;font-family:'Inter',sans-serif;font-weight:600;color:#f1e9d6;background:rgba(40,36,30,.88);
 border:1px solid rgba(200,168,88,.45);border-radius:28px;padding:14px 24px;font-size:26px;box-shadow:0 10px 30px rgba(0,0,0,.7)}
.card{position:absolute;left:90px;top:590px;width:700px;height:500px;z-index:10;transform:rotate(-3deg);background:#f4ecd8;padding:16px 16px 70px;
 box-shadow:0 40px 80px rgba(0,0,0,.9)}
.card img{width:100%;height:100%;object-fit:cover;object-position:50% 70%;display:block}
.card .cap{position:absolute;left:0;right:0;bottom:16px;text-align:center;font-family:'Oswald';font-weight:700;font-size:30px;letter-spacing:6px;color:#1a140a}
""", body="""
<div class="big white" style="top:120px;font-size:92px;white-space:nowrap">&ldquo;THE AVERAGE MIAA TEAM</div>
<div class="big gold" style="top:222px;font-size:220px">WIPES</div>
<div class="big white" style="top:410px;font-size:84px;white-space:nowrap">ANY NOVA PUBLIC SCHOOL.&rdquo;</div>
<div class="line" style="top:520px;font-size:24px;letter-spacing:3px;color:#cfc2a0">MARYLAND SAID IT. NOT US.</div>
<div class="card"><img src="../cutouts5/loyola-card.jpg"><div class="cap">EXHIBIT A</div></div>
<img class="p" src="../cutouts5/j1.png" style="left:610px;top:450px;height:690px;z-index:12;filter:drop-shadow(0 24px 30px rgba(0,0,0,.85)) contrast(1.08)">
<div class="bub" style="left:40px;top:575px;transform:rotate(-6deg)">Maryland runs the DMV</div>
<div class="bub" style="left:700px;top:1120px;transform:rotate(4deg)">them NoVA boys phony</div>
<div class="line" style="top:1225px;font-size:30px;font-weight:700;letter-spacing:5px;z-index:15">DEC 21 WE FIND OUT.</div>
""")

pages['05'] = dict(bg='<div class="vafull"></div><div class="tshade"></div>', css="""
.stamp{position:absolute;white-space:nowrap;left:560px;top:520px;z-index:22;transform:rotate(-10deg);border:5px solid #c8a858;color:#c8a858;
 font-family:'Oswald',sans-serif;font-weight:700;font-size:38px;letter-spacing:6px;padding:10px 22px;background:rgba(5,5,5,.6)}
.pill{position:absolute;left:50%;transform:translateX(-50%);bottom:130px;z-index:25;white-space:nowrap;font-family:'Inter';font-weight:600;font-size:30px;
 color:#f1e9d6;background:rgba(5,5,5,.82);border:1px solid rgba(200,168,88,.5);border-radius:40px;padding:16px 34px}
""", body="""
<div class="line" style="top:130px;font-size:34px;font-weight:700;letter-spacing:14px;color:#c8a858">PREDICTION:</div>
<div class="big white" style="top:195px;font-size:172px">VIRGINIA</div>
<div class="big gold" style="top:350px;font-size:200px">SWEEPS.</div>
<img class="p" src="../cutouts5/v2.png" style="left:-40px;top:560px;width:1160px;z-index:6">
<div class="stamp">SAVED FOR DEC 21</div>
<div class="fade" style="height:240px;z-index:20;background:linear-gradient(to bottom,rgba(5,5,5,0),rgba(5,5,5,.92) 70%)"></div>
<div class="pill">Screenshot this, Maryland. <b style="color:#efd287">Prove us wrong.</b></div>
""")

pages['06'] = dict(bg=SPLIT + '<div class="topshade"></div>', css=split_css(640, 440, fx=-120, fy=-40, fw=2100) + """
.phone{position:absolute;left:210px;top:290px;width:660px;height:830px;z-index:10;border-radius:56px;background:#0d0d0f;
 border:3px solid #2b2b2e;box-shadow:0 40px 90px rgba(0,0,0,.9),0 0 0 10px #151517}
.top{position:absolute;left:0;right:0;top:0;height:120px;border-bottom:1px solid #222;text-align:center;padding-top:30px}
.top .av{width:54px;height:54px;border-radius:50%;margin:0 auto;background:linear-gradient(135deg,#c8a858,#6d5114);
 font-family:'Oswald';font-weight:700;color:#050505;font-size:20px;line-height:54px}
.top .nm{font-family:'Inter';font-weight:600;color:#eee;font-size:20px;margin-top:6px}
.msgs{position:absolute;left:30px;right:30px;top:150px}
.m{font-family:'Inter';font-size:28px;line-height:1.3;padding:16px 24px;border-radius:30px;margin:10px 0;max-width:78%;clear:both}
.l{float:left;background:#2b2b2e;color:#f2f2f2;border-bottom-left-radius:8px}
.r{float:right;background:linear-gradient(180deg,#e9c766,#c49a3a);color:#0a0a0a;font-weight:600;border-bottom-right-radius:8px}
.who{clear:both;font-family:'Inter';font-size:16px;color:#8c8c90;margin:16px 0 -4px 14px}
.typing{float:left;clear:both;background:#2b2b2e;border-radius:30px;padding:22px 26px;margin-top:10px}
.typing i{display:inline-block;width:12px;height:12px;border-radius:50%;background:#8c8c90;margin:0 4px}
.seen{clear:both;float:right;font-family:'Inter';font-size:16px;color:#8c8c90;margin-top:4px}
""", body="""
<div class="big white" style="top:120px;font-size:72px;line-height:1">EVERY DMV GROUP CHAT</div>
<div class="big gold" style="top:200px;font-size:72px;line-height:1">HAS HAD THIS ARGUMENT.</div>
<div class="phone"><div class="top"><div class="av">DMV</div><div class="nm">the DMV chat</div></div>
<div class="msgs">
 <div class="who">MARYLAND</div><div class="m l">Maryland &gt; Virginia. not even close</div>
 <div class="who" style="text-align:right;margin-right:14px">VIRGINIA</div><div class="m r">bet</div>
 <div class="m r">$3,000 says prove it. Dec 21, SoFive Columbia</div>
 <div class="seen">Seen 9:41 PM</div>
 <div class="who">MARYLAND</div><div class="typing"><i></i><i style="opacity:.7"></i><i style="opacity:.4"></i></div>
</div></div>
<div class="line" style="top:1160px;font-size:30px;font-weight:600;letter-spacing:6px;z-index:31">STILL TYPING. DEC 21 SETTLES IT.</div>
""")

pages['07'] = dict(bg=STAD, css="""
.vf{position:absolute;left:110px;top:430px;width:860px;height:640px;z-index:12}
.vf .c{position:absolute;width:70px;height:70px;border-color:#f1e9d6;border-style:solid;opacity:.9}
.rec{position:absolute;left:40px;top:34px;font-family:'Inter';font-weight:700;font-size:28px;color:#fff;letter-spacing:3px;z-index:14}
.rec b{display:inline-block;width:20px;height:20px;border-radius:50%;background:#e23b3b;margin-right:12px;box-shadow:0 0 12px #e23b3b}
.tc{position:absolute;right:40px;top:34px;font-family:'Inter';font-weight:600;font-size:26px;color:#fff;letter-spacing:3px}
.gm{position:absolute;left:40px;bottom:30px;font-family:'Inter';font-weight:600;font-size:22px;color:#fff;letter-spacing:3px}
""", body="""
<div class="big white" style="top:125px;font-size:120px;white-space:nowrap">3 GAMES MINIMUM.</div>
<div class="big gold" style="top:245px;font-size:110px">ALL RECORDED.</div>
<div class="vf">
 <div class="c" style="left:0;top:0;border-width:4px 0 0 4px"></div><div class="c" style="right:0;top:0;border-width:4px 4px 0 0"></div>
 <div class="c" style="left:0;bottom:0;border-width:0 0 4px 4px"></div><div class="c" style="right:0;bottom:0;border-width:0 4px 4px 0"></div>
 <div class="rec"><b></b>REC</div><div class="tc">00:03:00</div><div class="gm">GROUP STAGE  •  GAME 3 OF 3</div>
</div>
<img class="p" src="../cutouts5/v1.png" style="left:230px;top:500px;width:620px;z-index:11">
<div class="fade" style="height:330px"></div>
<div class="line" style="top:1090px;font-size:32px">Every game on camera. So when Maryland loses, <b style="color:#efd287">there's proof.</b></div>
""")

CLOSE = dict(bg=SPLIT + '<div class="topshade"></div>', css=split_css(560, 520, fx=-120, fy=-40, fw=2100) + """
.tro{position:absolute;left:50%;top:430px;height:520px;transform:translateX(-50%);z-index:8;
 filter:drop-shadow(0 0 40px rgba(255,210,120,.3)) drop-shadow(0 40px 40px rgba(0,0,0,.85))}
.row{position:absolute;left:0;right:0;text-align:center;font-family:'Inter';font-weight:600;color:#f1e9d6;z-index:20;letter-spacing:2px}
""", body="""
<div class="side" style="left:40px;top:470px;font-size:58px">MARYLAND</div><div class="side" style="right:40px;top:470px;font-size:58px;text-align:right">VIRGINIA</div>
<div class="big white" style="top:120px;font-size:150px">WHO RUNS</div>
<div class="big gold" style="top:250px;font-size:150px">THE DMV?</div>
<img class="tro" src="../trophy/photo-trophy-short.png">
<div class="fade" style="height:520px"></div>
<div class="row" style="top:900px;font-size:26px;letter-spacing:6px;color:#e9d9ad">MARYLAND VS VIRGINIA. <b style="color:#efd287">PICK YOUR SIDE.</b></div>
<div class="row" style="top:950px;font-size:30px">32 teams. 3 games minimum. Every game recorded.</div>
<div class="row" style="top:995px;font-size:30px">Early bird <b style="color:#efd287">$450 a team</b> through Nov 25.</div>
<div class="row" style="top:1040px;font-size:30px">Follow <b style="color:#efd287">@strivesoccerfc</b> for the schedule.</div>
""")
SWIPE = ('<div style="position:absolute;left:56px;right:120px;bottom:56px;z-index:30;display:flex;justify-content:flex-end;'
         'font-family:Inter;font-weight:600;font-size:20px;letter-spacing:6px;color:#cfc2a0">'
         '<span style="color:#c8a858">SWIPE &rarr;</span></div>')
FULL = ('<div class="foot" style="bottom:44px;height:auto"><div class="prize"><b>$3,000</b> CASH<span style="color:#c8a858;margin:0 18px">•</span>32 TEAMS</div>'
        '<div class="meta">MON, DEC 21<i>•</i>SOFIVE COLUMBIA</div><div class="url">THESTRIVEAPP.COM/5V5</div></div>')
order = ['01', '02', '04', '06', '03', '05', '07']  # the carousel order: trap, backyard, all talk, group chat, wanted, prediction, 3 games
for i, k in enumerate(order, 1):
    v = dict(pages[k]); v['foot'] = SWIPE.format(n=i)
    open(f'{i:02d}.html', 'w').write(HEAD.format(**v))
open('08.html', 'w').write(HEAD.format(**CLOSE, foot=FULL))
print('ok')
