"""Face track for the reel builder. Run on the zoom-only pass (reel_build.py's
zoompan filter, no overlays) so the boxes are in output coordinates:
  python3 faces.py zoomed.mp4 faces.json
OpenCV YuNet (models/face_detection_yunet_2023mar.onnx, from opencv_zoo,
MIT) every 3rd frame at 540x960, boxes scaled to 1080x1920. YuNet keeps the
face when the player looks down at the ball, which Haar lost (Nov 4 2026:
on the montage reels Haar saw 34 of 217 samples, YuNet 207, and the list
had landed on two players' heads). Haar frontal + profile is the fallback
only when the model file is missing, and says so."""
import cv2, json, os, sys

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_detection_yunet_2023mar.onnx")
cap = cv2.VideoCapture(sys.argv[1]); fps = cap.get(cv2.CAP_PROP_FPS); n = 0; out = []
if os.path.exists(MODEL):
    det = cv2.FaceDetectorYN.create(MODEL, "", (540, 960), score_threshold=0.5, nms_threshold=0.3, top_k=50)
    def find(small):
        _, faces = det.detect(small)
        if faces is None or not len(faces):
            return None
        b = max(faces, key=lambda f: f[-1])
        return [int(v * 2) for v in b[:4]]
    how = "yunet"
else:
    print("WARNING: YuNet model missing, falling back to Haar (misses faces looking down)")
    cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    prof = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
    def find(small):
        g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        f = list(cas.detectMultiScale(g, 1.1, 5, minSize=(28, 28))) or list(prof.detectMultiScale(g, 1.1, 5, minSize=(28, 28)))
        return [int(v * 2) for v in max(f, key=lambda b: b[2] * b[3])] if f else None
    how = "haar"
while True:
    ok, fr = cap.read()
    if not ok: break
    if n % 3 == 0:
        out.append({"t": round(n / fps, 2), "face": find(cv2.resize(fr, (540, 960)))})
    n += 1
json.dump(out, open(sys.argv[2], "w"))
print(len(out), "samples,", sum(1 for o in out if o["face"]), f"with a face ({how})")
