import UIKit
import WebKit
import Capacitor

// The app's one screen: Capacitor's web view showing thestriveapp.com, set
// up to feel like an iPhone app rather than a website (Nov 23 2026).
//
// Swipe back from the left edge goes back a screen, the way every iPhone
// app does: the web view's own back gesture, which follows the site's
// history, so it works for every screen with nothing added to the site.
// (The site's own sideways swipe between tabs never starts at the edge,
// lib/elite/tab-motion.ts EDGE_PX, so the two never fight.)
//
// The rest is set where Capacitor sets it: link previews off
// (capacitor.config.ts ios.allowsLinkPreview), and the page never
// rubber-banding past its ends (Capacitor turns the scroll view's bounce
// off itself, and the site holds still with overscroll-behavior none).
class StriveBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }
}
