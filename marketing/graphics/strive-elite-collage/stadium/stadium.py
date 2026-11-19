# Builds a night-stadium backdrop with a blurred crowd (no stock photo): python3 stadium.py out.png
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
rng=np.random.default_rng(7); W,H=2160,2700
bg=Image.new("RGB",(W,H),(6,6,8)); d=ImageDraw.Draw(bg)
# stand bowl: tiers as curved bands, darker further up
def tier_y(x,base,sag): return base+sag*((x-W/2)/(W/2))**2
for t,(base,sag,scale) in enumerate([(560,-160,7),(760,-150,9),(960,-130,11),(1160,-110,13),(1360,-90,16),(1560,-70,19)]):
    for x in np.arange(-40,W+40,scale*1.15):
        for row in range(int(200/(scale*2.3))+2):
            y=tier_y(x,base,sag)+row*scale*2.3+rng.normal(0,scale*.4)
            xx=x+rng.normal(0,scale*.35)+ (row%2)*scale*.5
            body=[(40,38,44),(70,20,22),(18,22,40),(200,200,205),(30,30,30),(120,90,30),(25,60,35)][rng.integers(7)]
            if rng.random()<.25: body=tuple(int(c*1.6) for c in body)
            skin=[(200,160,130),(150,110,80),(95,65,45),(230,190,160)][rng.integers(4)]
            d.ellipse([xx-scale*.55,y+scale*.9,xx+scale*.55,y+scale*2.6],fill=body)
            d.ellipse([xx-scale*.35,y,xx+scale*.35,y+scale*.95],fill=skin)
            if rng.random()<.012:  # phone flash / scarf
                d.ellipse([xx-scale*.25,y-scale*.6,xx+scale*.25,y-scale*.1],fill=(255,245,220))
    # railing under each tier
d.rectangle([0,1745,W,1800],fill=(120,95,40))
img=bg.filter(ImageFilter.GaussianBlur(5))
a=np.asarray(img).astype(np.float32)/255
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
# pitch glow under the stands
a[1700:]=a[1700:]*.4
# floodlight wash from top corners + warm grade
for cx,cy in [(260,180),(1900,180),(1080,60)]:
    r=np.hypot(xx-cx,yy-cy); a+= (np.exp(-r/650)*np.array([1,.86,.6]))[...,None].squeeze()[...,None]*0 if False else (np.exp(-r/650)[...,None]*np.array([.55,.45,.3]))
lum=a.mean(2,keepdims=True); a=lum*np.array([1.05,.88,.6])*.8+a*.35   # gold monochrome-ish
# vignette and darken centre bottom so the type and trophy sit on black
v=np.clip(1-np.hypot((xx-W/2)/W*1.3,(yy-H*.45)/H*1.1)**2*1.4,0,1)[...,None]
a*=v*.9+.1
a[...,:]*=np.clip(1.4-(yy/H)*1.2,0.15,1)[...,None]
out=Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8))
# floodlight banks with star flare
fl=Image.new("RGB",(W,H),(0,0,0)); f=ImageDraw.Draw(fl)
for cx,cy in [(260,180),(1900,180)]:
    for i in range(5):
        for j in range(2):
            x,y=cx-120+i*60,cy-30+j*55; f.ellipse([x-16,y-16,x+16,y+16],fill=(255,248,225))
glow=fl.filter(ImageFilter.GaussianBlur(40)); glow2=fl.filter(ImageFilter.GaussianBlur(8))
o=np.asarray(out).astype(np.float32)+np.asarray(glow).astype(np.float32)*1.6+np.asarray(glow2).astype(np.float32)*.9+np.asarray(fl).astype(np.float32)*.6
Image.fromarray(np.clip(o,0,255).astype(np.uint8)).save(sys.argv[1]); print("ok")
