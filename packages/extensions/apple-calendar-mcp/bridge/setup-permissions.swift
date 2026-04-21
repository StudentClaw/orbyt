#!/usr/bin/env swift

import EventKit
import Foundation

let store = EKEventStore()
let semaphore = DispatchSemaphore(value: 0)
var granted = false
var permissionError: Error?

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { success, error in
        granted = success
        permissionError = error
        semaphore.signal()
    }
} else {
    store.requestAccess(to: .event) { success, error in
        granted = success
        permissionError = error
        semaphore.signal()
    }
}

_ = semaphore.wait(timeout: .now() + 30)

if let permissionError {
    fputs("Failed to request calendar access: \(permissionError)\n", stderr)
    exit(1)
}

if granted {
    print("Calendar access granted.")
    exit(0)
}

fputs("Calendar access was denied.\n", stderr)
exit(1)
