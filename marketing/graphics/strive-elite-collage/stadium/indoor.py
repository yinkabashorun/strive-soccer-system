# Indoor 5v5 arena backdrop, built (no stock photo): python3 indoor.py out.png
# Turf floor in perspective, dasher boards and netting, a truss ceiling with rows of
# lights, soft haze beams and bloom, graded warm and dark so the gold type sits on it.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
rng=np.random.default_rng(3); W,H=2160,2700; VX,VY=1080,1480
img=Image.new("RGB",(W,H),(8,8,10)); d=ImageDraw.Draw(img)
# ceiling: dark with a faint warm lift toward the centre
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
a=np.zeros((H,W,3),np.float32)
cg=np.exp(-((xx-VX)/1300)**2-((yy-900)/900)**2)
a+=cg[...,None]*np.array([.10,.085,.06])
img=Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)); d=ImageDraw.Draw(img)
def P(X,Y,Z):  # world to screen, camera at height 0, looking down +Z
    return VX+X*900/Z, VY+Y*900/Z
# trusses: lines along depth (X fixed) and cross beams (Z fixed), ceiling height Y=-6
for X in np.arange(-16,17,4):
    d.line([P(X,-6,1.2),P(X,-6,60)],fill=(30,28,26),width=6)
for Z in [1.6,2.2,3,4,5.5,7.5,10,14,20,30]:
    w=max(2,int(14/Z)); d.line([P(-30,-6,Z),P(30,-6,Z)],fill=(28,26,24),width=w)
# back wall at Z=26: netting above, white dasher boards at the floor line
bx0,by0=P(-14,-6,26); bx1,byf=P(14,1.6,26)
d.rectangle([0,by0,W,byf],fill=(22,22,24))
for x in np.arange(-14,14.1,1.2):
    p0=P(x,-5,26); p1=P(x,1.6,26); d.line([p0,p1],fill=(40,40,42),width=2)
_,bt=P(0,0.6,26); d.rectangle([0,bt,W,byf],fill=(150,148,142))     # dasher boards
_,bt2=P(0,0.75,26); d.line([(0,bt2),(W,bt2)],fill=(110,108,104),width=3)
# turf floor below the boards
fl=np.zeros((H,W,3),np.float32); top=int(byf)
depth=np.clip((yy-VY)/ (H-VY),0.001,1)
turf=np.array([.11,.30,.15])
noise=rng.normal(0,1,(H,W)).astype(np.float32)
noise=np.asarray(Image.fromarray(((noise*20+128).clip(0,255)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)/255-.5
shade=(0.35+0.65*depth)[...,None]*turf*(1+noise[...,None]*0.5)
base=np.asarray(img).astype(np.float32)/255
mask=(yy>=top)[...,None]
base=np.where(mask,shade,base)
img=Image.fromarray((np.clip(base,0,1)*255).astype(np.uint8)); d=ImageDraw.Draw(img)
# pitch lines: halfway line, centre circle, touchlines (white, thin with depth)
d.line([P(-12,1.6,9),P(12,1.6,9)],fill=(200,205,200),width=5)
pts=[P(3.2*np.cos(t),1.6,9+3.2*np.sin(t)) for t in np.linspace(0,2*np.pi,120)]
d.line(pts+[pts[0]],fill=(200,205,200),width=4)
for X in (-12,12): d.line([P(X,1.6,2),P(X,1.6,26)],fill=(190,195,190),width=5)
# light pools on the turf under every fixture, so the floor glows where it is lit
F=Image.new("RGB",(W,H),(0,0,0)); fd=ImageDraw.Draw(F)
for Z in [1.9,2.6,3.5,4.7,6.3,8.5,11.5,16,22]:
    for X in np.arange(-12,12.1,4):
        x,y=P(X,1.6,Z); rx=2600/Z; ry=rx*0.22
        fd.ellipse([x-rx,y-ry,x+rx,y+ry],fill=(70,80,55))
F=F.filter(ImageFilter.GaussianBlur(60))
o0=np.asarray(img).astype(np.float32)/255
o0=o0+np.asarray(F).astype(np.float32)/255*(yy>=top)[...,None]*0.45
img=Image.fromarray((np.clip(o0,0,1)*255).astype(np.uint8)); d=ImageDraw.Draw(img)
# lights: rows of fixtures on the trusses, glowing
L=Image.new("RGB",(W,H),(0,0,0)); ld=ImageDraw.Draw(L)
lights=[]
for Z in [1.9,2.6,3.5,4.7,6.3,8.5,11.5,16,22]:
    for X in np.arange(-12,12.1,4):
        x,y=P(X,-5.7,Z); r=60/Z
        ld.ellipse([x-r*1.6,y-r*.55,x+r*1.6,y+r*.55],fill=(255,244,220)); lights.append((x,y,r))
# haze beams from the nearer lights down to the floor
B=Image.new("L",(W,H),0); bd=ImageDraw.Draw(B)
for (x,y,r) in lights:
    if r<3: continue
    fx,fy=x+(x-VX)*0.05, y+1300*(r/40)
    bd.polygon([(x-r,y),(x+r,y),(fx+r*7,fy),(fx-r*7,fy)],fill=int(min(60,r*1.3)))
B=B.filter(ImageFilter.GaussianBlur(40))
o=np.asarray(img).astype(np.float32)/255
beam=np.asarray(B).astype(np.float32)[...,None]/255*np.array([1,.93,.8])
o=o+beam*1.5
l=np.asarray(L).astype(np.float32)/255
o=o+l*0.9+np.asarray(L.filter(ImageFilter.GaussianBlur(22))).astype(np.float32)[...,]/255*4\
     +np.asarray(L.filter(ImageFilter.GaussianBlur(80))).astype(np.float32)/255*9
# soft haze over the back half, grade warm, vignette
haze=np.exp(-((yy-1350)/600)**2)[...,None]*np.array([.07,.06,.045])
o=o+haze
lum=o.mean(2,keepdims=True); o=o*0.8+lum*np.array([1.06,.97,.80])*0.2
v=np.clip(1-(((xx-VX)/W*1.25)**2+((yy-H*.5)/H*1.1)**2)*1.1,0.25,1)[...,None]
o=o*v
Image.fromarray((np.clip(o,0,1)**1.05*255).astype(np.uint8)).save(sys.argv[1]); print("ok")
