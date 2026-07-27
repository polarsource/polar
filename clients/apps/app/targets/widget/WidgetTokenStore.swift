import Foundation

enum WidgetTokenStore {
    private static let accessGroup = "55U3YA3QTA.com.polarsource.Polar"
    private static let appGroup = "group.com.polarsource.Polar"

    private static let writeService = "app:no-auth"
    private static let readServices = ["app:no-auth", "app:auth", "app"]

    private static let clientID =
        "polar_ci_yZLBGwoWZVsOdfN5CODRwVSTlJfwJhXqwg65e2CuNMZ"
    private static let tokenEndpoint =
        URL(string: "https://api.polar.sh/v1/oauth2/token")!

    private static let accessTokenKey = "session"
    private static let refreshTokenKey = "session_refresh_token"
    private static let expiresAtKey = "session_expires_at"
    private static let legacyTokenKey = "widget_api_token"

    private static let refreshMarginMs: Double = 60_000

    static func apiToken() async -> String? {
        if let fresh = freshAccessToken() {
            return fresh
        }
        if let refreshed = await refreshSerialized() {
            return refreshed
        }
        return UserDefaults(suiteName: appGroup)?.string(forKey: legacyTokenKey)
    }

    static func forceRefresh() async -> String? {
        return await withRefreshLock {
            if let fresh = freshAccessToken() {
                return fresh
            }
            return await performRefresh() ?? freshAccessToken()
        }
    }

    private static func freshAccessToken() -> String? {
        guard let token = keychainRead(accessTokenKey) else { return nil }
        guard let raw = keychainRead(expiresAtKey), let expiresAtMs = Double(raw)
        else {
            return nil
        }
        let nowMs = Date().timeIntervalSince1970 * 1000
        return (expiresAtMs - nowMs) > refreshMarginMs ? token : nil
    }

    private static func refreshSerialized() async -> String? {
        return await withRefreshLock {
            if let fresh = freshAccessToken() {
                return fresh
            }
            return await performRefresh() ?? freshAccessToken()
        }
    }

    private struct RefreshResponse: Decodable {
        let accessToken: String
        let refreshToken: String?
        let expiresIn: Double?

        enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case refreshToken = "refresh_token"
            case expiresIn = "expires_in"
        }
    }

    private static func performRefresh() async -> String? {
        guard let refreshToken = keychainRead(refreshTokenKey) else { return nil }

        var request = URLRequest(url: tokenEndpoint)
        request.httpMethod = "POST"
        request.setValue(
            "application/x-www-form-urlencoded",
            forHTTPHeaderField: "Content-Type"
        )

        var components = URLComponents()
        components.queryItems = [
            URLQueryItem(name: "grant_type", value: "refresh_token"),
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "refresh_token", value: refreshToken),
        ]
        request.httpBody = components.percentEncodedQuery?.data(using: .utf8)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200
            else {
                return nil
            }
            let decoded = try JSONDecoder().decode(RefreshResponse.self, from: data)

            keychainWrite(accessTokenKey, decoded.accessToken)
            if let newRefreshToken = decoded.refreshToken {
                keychainWrite(refreshTokenKey, newRefreshToken)
            }
            if let expiresIn = decoded.expiresIn {
                let expiresAtMs =
                    (Date().timeIntervalSince1970 * 1000) + (expiresIn * 1000)
                keychainWrite(expiresAtKey, String(Int(expiresAtMs)))
            }
            UserDefaults(suiteName: appGroup)?
                .set(decoded.accessToken, forKey: legacyTokenKey)
            return decoded.accessToken
        } catch {
            return nil
        }
    }

    private static func withRefreshLock(_ body: () async -> String?) async
        -> String?
    {
        guard
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroup
            )
        else {
            return await body()
        }
        let lockURL = container.appendingPathComponent("token-refresh.lock")
        let fd = open(lockURL.path, O_CREAT | O_RDWR, 0o600)
        if fd == -1 {
            return await body()
        }
        defer { close(fd) }
        flock(fd, LOCK_EX)
        defer { flock(fd, LOCK_UN) }
        return await body()
    }

    private static func keychainBaseQuery(_ key: String, service: String)
        -> [String: Any]
    {
        let account = Data(key.utf8)
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrGeneric as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    private static func keychainRead(_ key: String) -> String? {
        for service in readServices {
            var query = keychainBaseQuery(key, service: service)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne

            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            if status == errSecSuccess, let data = result as? Data,
                let value = String(data: data, encoding: .utf8)
            {
                return value
            }
        }
        return nil
    }

    @discardableResult
    private static func keychainWrite(_ key: String, _ value: String) -> Bool {
        let base = keychainBaseQuery(key, service: writeService)
        let valueData = Data(value.utf8)

        let updateStatus = SecItemUpdate(
            base as CFDictionary,
            [
                kSecValueData as String: valueData,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            ] as CFDictionary
        )
        if updateStatus == errSecSuccess {
            return true
        }

        if updateStatus != errSecItemNotFound {
            SecItemDelete(base as CFDictionary)
        }

        var addQuery = base
        addQuery[kSecValueData as String] = valueData
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }
}
