// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "CalendarAPIBridge",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "CalendarAPIBridge", targets: ["CalendarAPIBridge"])
    ],
    targets: [
        .executableTarget(
            name: "CalendarAPIBridge",
            path: "Sources"
        )
    ]
)
