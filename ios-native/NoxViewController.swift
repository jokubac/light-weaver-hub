import UIKit
import Capacitor

// Registers NOX's own native plugins (CoreMIDI) and keeps the console full screen in landscape.
class NoxViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NoxMidiPlugin())
    }
    override var prefersStatusBarHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
}
