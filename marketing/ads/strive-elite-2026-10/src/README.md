# Strive Elite static ads, Oct 2026 (VSL funnel)

Five 1080x1350 feed ads. Finals in `../final/`. Each ad is `adN.html`
rendered with headless Chromium at 1080x1350 (fonts are local, no network).
The app cards are `card-hw-N.html` (a real bank drill, real description,
a real frame from that drill's video) and `card-pg-N.html` (progress card
whose biggest gain matches the drill's attribute). Re-render:

    CH=/opt/pw-browsers/chromium-*/chrome-linux/chrome
    $CH --headless=new --no-sandbox --window-size=908,900  --screenshot=card-hw-1.png file://$PWD/card-hw-1.html
    $CH --headless=new --no-sandbox --window-size=908,1100 --screenshot=card-pg-1.png file://$PWD/card-pg-1.html
    $CH --headless=new --no-sandbox --window-size=1080,1350 --screenshot=../final/strive-elite-ad-1.png file://$PWD/ad1.html

Rules baked in: brand standard (black, white Barlow Condensed, gold only
on eyebrow/underlines, real logo), no em dashes, no "AI", no alumni names
(private: calls + VSL only), only filmed bank drills, real price/deadline.
Ads 1-4 are cold-traffic "watch the video" ads; ad 5 is the retargeting
offer ad. CTA: thestriveapp.com/demo (the VSL landing page).
