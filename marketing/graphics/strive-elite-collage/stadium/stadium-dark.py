# His stadium photo, regraded to a dark ambient night look: python3 stadium-dark.py src.png out.png
import sys, numpy as np
from PIL import Image, ImageFilter
im=Image.open(sys.argv[1]).convert('RGB'); w,h=im.size
cw=int(h*0.8); x0=(w-cw)//2
im=im.crop((x0,0,x0+cw,h)).resize((2160,2700),Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.5))
a=np.asarray(im).astype(np.float32)/255
H,W=a.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
lum=a.mean(2,keepdims=True)
sky=np.clip(1-(yy/H-0.30)/0.18,0,1)[...,None]            # top band is sky: turn it to night
base=a**2.2*0.32                                     # crush mids into the dark
glow=np.clip((lum-0.86)/0.14,0,1)**2*(1-sky)               # keep the floodlights and the brightest stands lit
lights=a*glow*1.25
o=base+lights
o=o*(1-sky*0.88)
tint=np.array([0.92,0.95,1.06])                      # cool ambient shadows
warm=np.array([1.08,1.0,0.86])                       # warm the lit parts
mix=np.clip(lum*1.6,0,1)
o=o*(tint*(1-mix)+warm*mix)
bloom=np.asarray(Image.fromarray((np.clip(lights,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(40))).astype(np.float32)/255
o=o+bloom*0.45
v=np.clip(1-(((xx-W/2)/W*1.2)**2+((yy-H*.48)/H*1.0)**2)*1.2,0.2,1)[...,None]
o=o*v
Image.fromarray((np.clip(o,0,1)*255).astype(np.uint8)).save(sys.argv[2]); print("ok")
