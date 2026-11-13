import cv2,sys
m='/home/user/strive-soccer-system/.claude/skills/strive-reel/models/face_detection_yunet_2023mar.onnx'
img=cv2.imread(sys.argv[1]); h,w=img.shape[:2]
d=cv2.FaceDetectorYN.create(m,'',(w,h),0.5,0.3,5000)
_,f=d.detect(img)
for r in sorted(f.tolist(),key=lambda r:r[0]):
    print(f'x {r[0]/2:6.0f}  eye_y {(r[5]+r[7])/4:6.1f}  size {r[3]/2:4.0f}  conf {r[-1]:.2f}')
