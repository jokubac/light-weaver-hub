import Foundation
import Capacitor
import CoreMIDI

// CoreMIDI input for the iPad app: USB / Bluetooth MIDI controllers send raw bytes to the console.
@objc(NoxMidiPlugin)
public class NoxMidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NoxMidiPlugin"
    public let jsName = "NoxMidi"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var started = false

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if !self.started {
                self.started = true
                MIDIClientCreateWithBlock("NOX" as CFString, &self.client) { [weak self] _ in
                    DispatchQueue.main.async { _ = self?.connectAll() }
                }
                MIDIInputPortCreateWithBlock(self.client, "NOX input" as CFString, &self.port) { [weak self] list, _ in
                    var packet = list.pointee.packet
                    var out: [Int] = []
                    for _ in 0..<list.pointee.numPackets {
                        let len = Int(packet.length)
                        withUnsafeBytes(of: packet.data) { raw in out.append(contentsOf: raw.prefix(len).map { Int($0) }) }
                        packet = MIDIPacketNext(&packet).pointee
                    }
                    if !out.isEmpty { self?.notifyListeners("message", data: ["bytes": out]) }
                }
            }
            call.resolve(["names": self.connectAll()])
        }
    }

    private func connectAll() -> [String] {
        var names: [String] = []
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            MIDIPortConnectSource(port, src, nil)
            var name: Unmanaged<CFString>?
            if MIDIObjectGetStringProperty(src, kMIDIPropertyDisplayName, &name) == noErr, let n = name?.takeRetainedValue() {
                names.append(n as String)
            } else {
                names.append("MIDI device")
            }
        }
        notifyListeners("devices", data: ["names": names])
        return names
    }
}
