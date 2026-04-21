import AppKit
import EventKit
import Foundation
import Network

struct CalendarDTO: Encodable {
    let id: String
    let title: String
    let color: String?
}

struct EventDTO: Encodable {
    let id: String
    let calendarId: String
    let title: String
    let startDate: String
    let endDate: String
    let location: String?
    let notes: String?
    let isAllDay: Bool
}

struct CreateCalendarRequest: Decodable {
    let title: String
    let color: String?
}

struct CreateEventRequest: Decodable {
    let title: String
    let startDate: String
    let endDate: String
    let location: String?
    let notes: String?
}

struct UpdateEventRequest: Decodable {
    let title: String?
    let startDate: String?
    let endDate: String?
    let location: String?
    let notes: String?
}

struct ErrorResponse: Encodable {
    let error: String
}

struct SuccessResponse: Encodable {
    let success: Bool
}

enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case DELETE
}

struct HTTPRequest {
    let method: HTTPMethod
    let path: String
    let headers: [String: String]
    let body: Data
}

struct HTTPResponse {
    let statusCode: Int
    let reasonPhrase: String
    let headers: [String: String]
    let body: Data

    func serialized() -> Data {
        var response = "HTTP/1.1 \(statusCode) \(reasonPhrase)\r\n"
        for (key, value) in headers {
            response += "\(key): \(value)\r\n"
        }
        response += "Content-Length: \(body.count)\r\n"
        response += "Connection: close\r\n"
        response += "\r\n"

        var data = Data(response.utf8)
        data.append(body)
        return data
    }
}

final class CalendarService {
    private let store = EKEventStore()
    private let expectedBearerToken: String
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()
    private let decoder = JSONDecoder()
    private let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    init(expectedBearerToken: String) {
        self.expectedBearerToken = expectedBearerToken
    }

    func authorize() throws {
        let semaphore = DispatchSemaphore(value: 0)
        var authorizationError: Error?
        var granted = false

        if #available(macOS 14.0, *) {
            store.requestFullAccessToEvents { success, error in
                granted = success
                authorizationError = error
                semaphore.signal()
            }
        } else {
            store.requestAccess(to: .event) { success, error in
                granted = success
                authorizationError = error
                semaphore.signal()
            }
        }

        semaphore.wait()

        if let authorizationError {
            throw authorizationError
        }

        guard granted else {
            throw NSError(
                domain: "CalendarAPIBridge",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Calendar access was denied."]
            )
        }
    }

    func handle(_ request: HTTPRequest) -> HTTPResponse {
        guard request.headers["Authorization"] == "Bearer \(expectedBearerToken)" else {
            return jsonResponse(
                statusCode: 401,
                reasonPhrase: "Unauthorized",
                body: ErrorResponse(error: "Missing or invalid bridge authorization token.")
            )
        }

        do {
            return try route(request)
        } catch {
            return jsonResponse(
                statusCode: 500,
                reasonPhrase: "Internal Server Error",
                body: ErrorResponse(error: error.localizedDescription)
            )
        }
    }

    private func route(_ request: HTTPRequest) throws -> HTTPResponse {
        let path = request.path.split(separator: "/").map(String.init)

        if request.path == "/health" && request.method == .GET {
            return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: SuccessResponse(success: true))
        }

        guard path.first == "calendars" else {
            return jsonResponse(
                statusCode: 404,
                reasonPhrase: "Not Found",
                body: ErrorResponse(error: "Unknown route")
            )
        }

        switch (request.method, path.count) {
        case (.GET, 1):
            return try listCalendars()
        case (.POST, 1):
            return try createCalendar(from: request.body)
        case (.GET, 2):
            return try getCalendar(id: path[1])
        case (.DELETE, 2):
            return try deleteCalendar(id: path[1])
        case (.GET, 3) where path[2] == "events":
            return try listEvents(calendarId: path[1])
        case (.POST, 3) where path[2] == "events":
            return try createEvent(calendarId: path[1], body: request.body)
        case (.GET, 4) where path[2] == "events":
            return try getEvent(calendarId: path[1], eventId: path[3])
        case (.PUT, 4) where path[2] == "events":
            return try updateEvent(calendarId: path[1], eventId: path[3], body: request.body)
        case (.DELETE, 4) where path[2] == "events":
            return try deleteEvent(calendarId: path[1], eventId: path[3])
        default:
            return jsonResponse(
                statusCode: 404,
                reasonPhrase: "Not Found",
                body: ErrorResponse(error: "Unsupported route")
            )
        }
    }

    private func listCalendars() throws -> HTTPResponse {
        try authorize()
        let calendars = store.calendars(for: .event).map(calendarDTO)
        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: calendars)
    }

    private func getCalendar(id: String) throws -> HTTPResponse {
        try authorize()
        guard let calendar = store.calendar(withIdentifier: id) else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Calendar not found"))
        }
        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: calendarDTO(calendar))
    }

    private func createCalendar(from body: Data) throws -> HTTPResponse {
        try authorize()
        let payload = try decoder.decode(CreateCalendarRequest.self, from: body)

        let calendar = EKCalendar(for: .event, eventStore: store)
        calendar.title = payload.title

        if let color = payload.color, let cgColor = hexColor(from: color)?.cgColor {
            calendar.cgColor = cgColor
        }

        if let source = preferredSource() {
            calendar.source = source
        } else {
            throw NSError(
                domain: "CalendarAPIBridge",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "No writable calendar source is available."]
            )
        }

        try store.saveCalendar(calendar, commit: true)
        return jsonResponse(statusCode: 201, reasonPhrase: "Created", body: calendarDTO(calendar))
    }

    private func deleteCalendar(id: String) throws -> HTTPResponse {
        try authorize()
        guard let calendar = store.calendar(withIdentifier: id) else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Calendar not found"))
        }
        try store.removeCalendar(calendar, commit: true)
        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: SuccessResponse(success: true))
    }

    private func listEvents(calendarId: String) throws -> HTTPResponse {
        try authorize()
        guard let calendar = store.calendar(withIdentifier: calendarId) else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Calendar not found"))
        }

        let start = Date(timeIntervalSinceNow: -60 * 60 * 24 * 365)
        let end = Date(timeIntervalSinceNow: 60 * 60 * 24 * 365 * 3)
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: [calendar])
        let events = store.events(matching: predicate)
            .sorted { $0.startDate < $1.startDate }
            .map(eventDTO)

        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: events)
    }

    private func getEvent(calendarId: String, eventId: String) throws -> HTTPResponse {
        try authorize()
        guard let event = store.event(withIdentifier: eventId), event.calendar.calendarIdentifier == calendarId else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Event not found"))
        }
        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: eventDTO(event))
    }

    private func createEvent(calendarId: String, body: Data) throws -> HTTPResponse {
        try authorize()
        guard let calendar = store.calendar(withIdentifier: calendarId) else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Calendar not found"))
        }

        let payload = try decoder.decode(CreateEventRequest.self, from: body)
        let event = EKEvent(eventStore: store)
        event.calendar = calendar
        event.title = payload.title
        event.startDate = try parseDate(payload.startDate)
        event.endDate = try parseDate(payload.endDate)
        event.location = payload.location
        event.notes = payload.notes

        try store.save(event, span: .thisEvent, commit: true)
        return jsonResponse(statusCode: 201, reasonPhrase: "Created", body: eventDTO(event))
    }

    private func updateEvent(calendarId: String, eventId: String, body: Data) throws -> HTTPResponse {
        try authorize()
        guard let event = store.event(withIdentifier: eventId), event.calendar.calendarIdentifier == calendarId else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Event not found"))
        }

        let payload = try decoder.decode(UpdateEventRequest.self, from: body)
        if let title = payload.title { event.title = title }
        if let startDate = payload.startDate { event.startDate = try parseDate(startDate) }
        if let endDate = payload.endDate { event.endDate = try parseDate(endDate) }
        if let location = payload.location { event.location = location }
        if let notes = payload.notes { event.notes = notes }

        try store.save(event, span: .thisEvent, commit: true)
        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: eventDTO(event))
    }

    private func deleteEvent(calendarId: String, eventId: String) throws -> HTTPResponse {
        try authorize()
        guard let event = store.event(withIdentifier: eventId), event.calendar.calendarIdentifier == calendarId else {
            return jsonResponse(statusCode: 404, reasonPhrase: "Not Found", body: ErrorResponse(error: "Event not found"))
        }

        try store.remove(event, span: .thisEvent, commit: true)
        return jsonResponse(statusCode: 200, reasonPhrase: "OK", body: SuccessResponse(success: true))
    }

    private func parseDate(_ value: String) throws -> Date {
        if let date = isoFormatter.date(from: value) {
            return date
        }

        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        if let date = fallback.date(from: value) {
            return date
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current

        let formats = [
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy/MM/dd HH:mm:ss"
        ]

        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: value) {
                return date
            }
        }

        throw NSError(
            domain: "CalendarAPIBridge",
            code: 3,
            userInfo: [NSLocalizedDescriptionKey: "Invalid ISO8601 date: \(value)"]
        )
    }

    private func preferredSource() -> EKSource? {
        if let defaultSource = store.defaultCalendarForNewEvents?.source {
            return defaultSource
        }

        let sources = store.sources
        return sources.first(where: { $0.sourceType == .local }) ??
            sources.first(where: { $0.sourceType == .calDAV }) ??
            sources.first
    }

    private func calendarDTO(_ calendar: EKCalendar) -> CalendarDTO {
        CalendarDTO(
            id: calendar.calendarIdentifier,
            title: calendar.title,
            color: calendar.cgColor.flatMap(hexString)
        )
    }

    private func eventDTO(_ event: EKEvent) -> EventDTO {
        EventDTO(
            id: event.eventIdentifier,
            calendarId: event.calendar.calendarIdentifier,
            title: event.title,
            startDate: isoFormatter.string(from: event.startDate),
            endDate: isoFormatter.string(from: event.endDate),
            location: event.location,
            notes: event.notes,
            isAllDay: event.isAllDay
        )
    }

    private func jsonResponse<T: Encodable>(statusCode: Int, reasonPhrase: String, body: T) -> HTTPResponse {
        let data = (try? encoder.encode(body)) ?? Data("{}".utf8)
        return HTTPResponse(
            statusCode: statusCode,
            reasonPhrase: reasonPhrase,
            headers: [
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            ],
            body: data
        )
    }

    private func hexString(from color: CGColor) -> String? {
        guard let components = color.components else { return nil }

        let red: CGFloat
        let green: CGFloat
        let blue: CGFloat

        switch components.count {
        case 4:
            red = components[0]
            green = components[1]
            blue = components[2]
        case 2:
            red = components[0]
            green = components[0]
            blue = components[0]
        default:
            return nil
        }

        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    private func hexColor(from string: String) -> NSColor? {
        var hex = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") {
            hex.removeFirst()
        }

        guard hex.count == 6, let value = Int(hex, radix: 16) else {
            return nil
        }

        let red = CGFloat((value >> 16) & 0xFF) / 255
        let green = CGFloat((value >> 8) & 0xFF) / 255
        let blue = CGFloat(value & 0xFF) / 255
        return NSColor(red: red, green: green, blue: blue, alpha: 1)
    }
}

final class HTTPServer {
    private let listener: NWListener
    private let service: CalendarService
    private let port: UInt16

    init(port: UInt16, token: String) throws {
        self.port = port
        self.service = CalendarService(expectedBearerToken: token)
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
    }

    func start() {
        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                fputs("CalendarAPIBridge listening on http://localhost:\(self.port)\n", stderr)
            case .failed(let error):
                fputs("Listener failed: \(error)\n", stderr)
                exit(1)
            default:
                break
            }
        }
        listener.start(queue: .global())
        dispatchMain()
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: .global())
        receive(on: connection, buffer: Data())
    }

    private func receive(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }

            if let error {
                fputs("Connection error: \(error)\n", stderr)
                connection.cancel()
                return
            }

            var nextBuffer = buffer
            if let data {
                nextBuffer.append(data)
            }

            if let request = Self.parseRequest(from: nextBuffer) {
                let response = self.service.handle(request)
                connection.send(content: response.serialized(), completion: .contentProcessed { _ in
                    connection.cancel()
                })
                return
            }

            if isComplete {
                connection.cancel()
                return
            }

            self.receive(on: connection, buffer: nextBuffer)
        }
    }

    private static func parseRequest(from data: Data) -> HTTPRequest? {
        guard let payload = String(data: data, encoding: .utf8),
              let headerRange = payload.range(of: "\r\n\r\n") else {
            return nil
        }

        let headerText = String(payload[..<headerRange.lowerBound])
        let bodyData = Data(payload[headerRange.upperBound...].utf8)
        let lines = headerText.components(separatedBy: "\r\n")

        guard let requestLine = lines.first else {
            return nil
        }

        let requestParts = requestLine.split(separator: " ")
        guard requestParts.count >= 2,
              let method = HTTPMethod(rawValue: String(requestParts[0])) else {
            return nil
        }

        let rawPath = String(requestParts[1])
        let path = rawPath.split(separator: "?", maxSplits: 1).first.map(String.init) ?? rawPath
        var headers: [String: String] = [:]

        for line in lines.dropFirst() {
            let parts = line.split(separator: ":", maxSplits: 1).map(String.init)
            if parts.count == 2 {
                headers[parts[0].trimmingCharacters(in: .whitespaces)] = parts[1].trimmingCharacters(in: .whitespaces)
            }
        }

        if let contentLengthValue = headers["Content-Length"],
           let contentLength = Int(contentLengthValue),
           bodyData.count < contentLength {
            return nil
        }

        return HTTPRequest(method: method, path: path, headers: headers, body: bodyData)
    }
}

let port = UInt16(ProcessInfo.processInfo.environment["PORT"] ?? "") ?? 8080
let token = ProcessInfo.processInfo.environment["MAC_API_BRIDGE_TOKEN"] ?? ""

do {
    let server = try HTTPServer(port: port, token: token)
    server.start()
} catch {
    fputs("Failed to start CalendarAPIBridge: \(error)\n", stderr)
    exit(1)
}
