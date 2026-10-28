"""Face track for the reel builder. Run on the zoom-only pass (build.py's
zoompan filter, no overlays) so the boxes are in output coordinates:
  python3 faces.py zoomed.mp4 faces.json
OpenCV Haar frontal face (profile as fallback), every 3rd frame, 1080x1920."""
import cv2, json, sys
cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
prof = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
cap = cv2.VideoCapture(sys.argv[1]); fps = cap.get(cv2.CAP_PROP_FPS); n = 0; out = []
while True:
    ok, fr = cap.read()
    if not ok: break
    if n % 3 == 0:
        g = cv2.cvtColor(cv2.resize(fr, (540, 960)), cv2.COLOR_BGR2GRAY)
        f = list(cas.detectMultiScale(g, 1.1, 5, minSize=(28, 28))) or list(prof.detectMultiScale(g, 1.1, 5, minSize=(28, 28)))
        best = max(f, key=lambda b: b[2] * b[3]) if f else None
        out.append({"t": round(n / fps, 2), "face": [int(v * 2) for v in best] if best is not None else None})
    n += 1
json.dump(out, open(sys.argv[2], "w"))
print(len(out), "samples,", sum(1 for o in out if o["face"]), "with a face")
