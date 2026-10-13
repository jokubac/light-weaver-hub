import UIKit
import Capacitor

// Registers NOX's own native plugins (CoreMIDI) with the Capacitor bridge.
class NoxViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NoxMidiPlugin())
    }
}
