// SmartPosture - Flutter API client example (Dio)
// -------------------------------------------------
//
// Add to pubspec.yaml:
//
//   dependencies:
//     dio: ^5.7.0
//     socket_io_client: ^2.0.3+1   # only if you use the optional live updates
//
// Base URL:
//   - Android Emulator : http://10.0.2.2:3000     (10.0.2.2 = the host computer)
//   - Physical device  : http://<computer-LAN-IP>:3000
//   - iOS Simulator/desktop : http://localhost:3000
//
// There is no authentication: no token, no login screen, no user account.

import 'package:dio/dio.dart';

// ===========================================================================
// Domain enums
// ===========================================================================

enum PostureLabel {
  goodPosture('GOOD_POSTURE'),
  slouching('SLOUCHING'),
  leanLeft('LEAN_LEFT'),
  leanRight('LEAN_RIGHT'),
  headForward('HEAD_FORWARD'),
  unknown('UNKNOWN');

  const PostureLabel(this.wireValue);
  final String wireValue;

  static PostureLabel fromWire(String? value) {
    return PostureLabel.values.firstWhere(
      (label) => label.wireValue == value,
      orElse: () => PostureLabel.unknown,
    );
  }
}

enum DeviceStatus {
  online('online'),
  offline('offline'),
  unknown('unknown');

  const DeviceStatus(this.wireValue);
  final String wireValue;

  static DeviceStatus fromWire(String? value) {
    return DeviceStatus.values.firstWhere(
      (status) => status.wireValue == value,
      orElse: () => DeviceStatus.unknown,
    );
  }
}

// ===========================================================================
// Errors
// ===========================================================================

/// Mirrors the backend error envelope:
/// { success: false, message, error: { code, details } }
class ApiException implements Exception {
  ApiException({required this.code, required this.message, this.statusCode, this.details});

  final String code;
  final String message;
  final int? statusCode;
  final Object? details;

  /// True when the request never reached the server (Wi-Fi down, server off).
  bool get isOffline => statusCode == null;

  @override
  String toString() => 'ApiException($code, $statusCode): $message';
}

// ===========================================================================
// Models (only the fields the app actually reads)
// ===========================================================================

class CurrentPosture {
  CurrentPosture({
    required this.available,
    required this.deviceId,
    required this.posture,
    required this.angle,
    required this.confidence,
    required this.alert,
    required this.battery,
    required this.sensorError,
    required this.deviceStatus,
    required this.lastSeen,
    required this.message,
  });

  final bool available;
  final String? deviceId;
  final PostureLabel? posture;
  final double? angle;
  final double? confidence;
  final bool alert;
  final int? battery;
  final bool sensorError;
  final DeviceStatus deviceStatus;
  final DateTime? lastSeen;
  final String? message;

  factory CurrentPosture.fromJson(Map<String, dynamic> json) {
    return CurrentPosture(
      available: json['available'] as bool? ?? false,
      deviceId: json['deviceId'] as String?,
      posture: json['posture'] == null ? null : PostureLabel.fromWire(json['posture'] as String?),
      angle: (json['angle'] as num?)?.toDouble(),
      confidence: (json['confidence'] as num?)?.toDouble(),
      alert: json['alert'] as bool? ?? false,
      battery: (json['battery'] as num?)?.toInt(),
      sensorError: json['sensorError'] as bool? ?? false,
      deviceStatus: DeviceStatus.fromWire(json['deviceStatus'] as String?),
      lastSeen: json['lastSeen'] == null ? null : DateTime.tryParse(json['lastSeen'] as String),
      message: json['message'] as String?,
    );
  }
}

class DashboardTotals {
  DashboardTotals({
    required this.measurements,
    required this.incorrectPostureEvents,
    required this.goodDurationSeconds,
    required this.badDurationSeconds,
    required this.monitoredDurationSeconds,
    required this.goodPosturePercentage,
    required this.averageAngle,
  });

  final int measurements;
  final int incorrectPostureEvents;
  final double goodDurationSeconds;
  final double badDurationSeconds;
  final double monitoredDurationSeconds;
  final double goodPosturePercentage;
  final double? averageAngle;

  factory DashboardTotals.fromJson(Map<String, dynamic> json) {
    return DashboardTotals(
      measurements: (json['measurements'] as num?)?.toInt() ?? 0,
      incorrectPostureEvents: (json['incorrectPostureEvents'] as num?)?.toInt() ?? 0,
      goodDurationSeconds: (json['goodDurationSeconds'] as num?)?.toDouble() ?? 0,
      badDurationSeconds: (json['badDurationSeconds'] as num?)?.toDouble() ?? 0,
      monitoredDurationSeconds: (json['monitoredDurationSeconds'] as num?)?.toDouble() ?? 0,
      goodPosturePercentage: (json['goodPosturePercentage'] as num?)?.toDouble() ?? 0,
      averageAngle: (json['averageAngle'] as num?)?.toDouble(),
    );
  }
}

class PostureDistributionEntry {
  PostureDistributionEntry({required this.label, required this.count, required this.percentage});

  final PostureLabel label;
  final int count;
  final double percentage;

  factory PostureDistributionEntry.fromJson(Map<String, dynamic> json) {
    return PostureDistributionEntry(
      label: PostureLabel.fromWire(json['label'] as String?),
      count: (json['count'] as num?)?.toInt() ?? 0,
      percentage: (json['percentage'] as num?)?.toDouble() ?? 0,
    );
  }
}

class TrendBucket {
  TrendBucket({
    required this.label,
    required this.measurements,
    required this.incorrectPostureEvents,
    required this.goodPosturePercentage,
    required this.badDurationSeconds,
  });

  final String label;
  final int measurements;
  final int incorrectPostureEvents;
  final double goodPosturePercentage;
  final double badDurationSeconds;

  factory TrendBucket.fromJson(Map<String, dynamic> json) {
    return TrendBucket(
      label: json['label'] as String? ?? '',
      measurements: (json['measurements'] as num?)?.toInt() ?? 0,
      incorrectPostureEvents: (json['incorrectPostureEvents'] as num?)?.toInt() ?? 0,
      goodPosturePercentage: (json['goodPosturePercentage'] as num?)?.toDouble() ?? 0,
      badDurationSeconds: (json['badDurationSeconds'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// `hasData == false` means the period genuinely has no measurements: show
/// `message` and an empty state instead of zeros pretending to be real data.
class DashboardSummary {
  DashboardSummary({
    required this.period,
    required this.deviceId,
    required this.hasData,
    required this.message,
    required this.totals,
    required this.postureDistribution,
    required this.trends,
  });

  final String period;
  final String? deviceId;
  final bool hasData;
  final String? message;
  final DashboardTotals totals;
  final List<PostureDistributionEntry> postureDistribution;
  final List<TrendBucket> trends;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    final distribution = (json['postureDistribution'] as List<dynamic>? ?? [])
        .map((item) => PostureDistributionEntry.fromJson(item as Map<String, dynamic>))
        .toList();
    final trends = (json['trends'] as List<dynamic>? ?? [])
        .map((item) => TrendBucket.fromJson(item as Map<String, dynamic>))
        .toList();
    return DashboardSummary(
      period: json['period'] as String? ?? 'day',
      deviceId: json['deviceId'] as String?,
      hasData: json['hasData'] as bool? ?? false,
      message: json['message'] as String?,
      totals: DashboardTotals.fromJson(json['totals'] as Map<String, dynamic>? ?? const {}),
      postureDistribution: distribution,
      trends: trends,
    );
  }
}

class DashboardView {
  DashboardView({required this.current, required this.summary});

  final CurrentPosture current;
  final DashboardSummary summary;

  factory DashboardView.fromJson(Map<String, dynamic> json) {
    return DashboardView(
      current: CurrentPosture.fromJson(json['current'] as Map<String, dynamic>? ?? const {}),
      summary: DashboardSummary.fromJson(json['summary'] as Map<String, dynamic>? ?? const {}),
    );
  }
}

class TelemetryRecord {
  TelemetryRecord({
    required this.id,
    required this.deviceId,
    required this.timestamp,
    required this.posture,
    required this.angle,
    required this.alert,
    required this.battery,
    required this.sensorError,
    required this.sessionId,
  });

  final String id;
  final String deviceId;
  final DateTime timestamp;
  final PostureLabel posture;
  final double angle;
  final bool alert;
  final int? battery;
  final bool sensorError;
  final String? sessionId;

  factory TelemetryRecord.fromJson(Map<String, dynamic> json) {
    final postureJson = json['posture'] as Map<String, dynamic>? ?? const {};
    return TelemetryRecord(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String? ?? '',
      timestamp: DateTime.parse(json['timestamp'] as String),
      posture: PostureLabel.fromWire(postureJson['label'] as String?),
      angle: (postureJson['angle'] as num?)?.toDouble() ?? 0,
      alert: json['alert'] as bool? ?? false,
      battery: (json['battery'] as num?)?.toInt(),
      sensorError: json['sensorError'] as bool? ?? false,
      sessionId: json['sessionId'] as String?,
    );
  }
}

class SessionStatistics {
  SessionStatistics({
    required this.measurements,
    required this.incorrectPostureEvents,
    required this.goodDurationSeconds,
    required this.badDurationSeconds,
    required this.goodPosturePercentage,
    required this.averageAngle,
  });

  final int measurements;
  final int incorrectPostureEvents;
  final double goodDurationSeconds;
  final double badDurationSeconds;
  final double goodPosturePercentage;
  final double? averageAngle;

  factory SessionStatistics.fromJson(Map<String, dynamic> json) {
    return SessionStatistics(
      measurements: (json['measurements'] as num?)?.toInt() ?? 0,
      incorrectPostureEvents: (json['incorrectPostureEvents'] as num?)?.toInt() ?? 0,
      goodDurationSeconds: (json['goodDurationSeconds'] as num?)?.toDouble() ?? 0,
      badDurationSeconds: (json['badDurationSeconds'] as num?)?.toDouble() ?? 0,
      goodPosturePercentage: (json['goodPosturePercentage'] as num?)?.toDouble() ?? 0,
      averageAngle: (json['averageAngle'] as num?)?.toDouble(),
    );
  }
}

class SessionRecord {
  SessionRecord({
    required this.id,
    required this.deviceId,
    required this.status,
    required this.startedAt,
    required this.endedAt,
    required this.durationSeconds,
    required this.statistics,
    required this.statisticsAreFinal,
    required this.notes,
  });

  final String id;
  final String deviceId;
  final String status; // 'active' | 'ended'
  final DateTime startedAt;
  final DateTime? endedAt;
  final int? durationSeconds;
  final SessionStatistics statistics;
  final bool statisticsAreFinal;
  final String? notes;

  bool get isActive => status == 'active';

  factory SessionRecord.fromJson(Map<String, dynamic> json) {
    return SessionRecord(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      startedAt: DateTime.parse(json['startedAt'] as String),
      endedAt: json['endedAt'] == null ? null : DateTime.tryParse(json['endedAt'] as String),
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      statistics: SessionStatistics.fromJson(json['statistics'] as Map<String, dynamic>? ?? const {}),
      statisticsAreFinal: json['statisticsAreFinal'] as bool? ?? false,
      notes: json['notes'] as String?,
    );
  }
}

class PostureEventRecord {
  PostureEventRecord({
    required this.id,
    required this.deviceId,
    required this.type,
    required this.severity,
    required this.timestamp,
  });

  final String id;
  final String deviceId;
  final String type;
  final String severity;
  final DateTime timestamp;

  factory PostureEventRecord.fromJson(Map<String, dynamic> json) {
    return PostureEventRecord(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String? ?? '',
      type: json['type'] as String? ?? '',
      severity: json['severity'] as String? ?? 'info',
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }
}

class RecommendationItem {
  RecommendationItem({required this.title, required this.detail, required this.priority});

  final String title;
  final String detail;
  final String priority;

  factory RecommendationItem.fromJson(Map<String, dynamic> json) {
    return RecommendationItem(
      title: json['title'] as String? ?? '',
      detail: json['detail'] as String? ?? '',
      priority: json['priority'] as String? ?? 'medium',
    );
  }
}

class Recommendation {
  Recommendation({
    required this.id,
    required this.period,
    required this.summary,
    required this.recommendations,
    required this.model,
    required this.status,
    required this.cached,
    required this.aiConfigured,
    required this.disclaimer,
  });

  final String id;
  final String period;
  final String? summary;
  final List<RecommendationItem> recommendations;
  final String model;
  final String status; // 'success' | 'error' | 'unavailable'
  final bool cached;
  final bool aiConfigured;
  final String disclaimer;

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    return Recommendation(
      id: json['id'] as String,
      period: json['period'] as String? ?? 'day',
      summary: json['summary'] as String?,
      recommendations: (json['recommendations'] as List<dynamic>? ?? [])
          .map((item) => RecommendationItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      model: json['model'] as String? ?? '',
      status: json['status'] as String? ?? 'success',
      cached: json['cached'] as bool? ?? false,
      aiConfigured: json['aiConfigured'] as bool? ?? false,
      disclaimer: json['disclaimer'] as String? ?? '',
    );
  }
}

/// Page envelope returned by the list endpoints.
class Paged<T> {
  Paged({required this.items, required this.page, required this.limit, required this.total, required this.totalPages});

  final List<T> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;
}

// ===========================================================================
// Client
// ===========================================================================

class SmartPostureApi {
  SmartPostureApi({
    String? baseUrl,
    Dio? dio,
  }) : _dio = dio ?? Dio() {
    _dio.options
      ..baseUrl = baseUrl ?? defaultBaseUrl()
      ..connectTimeout = const Duration(seconds: 5)
      ..receiveTimeout = const Duration(seconds: 20)
      ..headers = {'Content-Type': 'application/json'};
  }

  final Dio _dio;

  /// Override with `--dart-define=SMARTPOSTURE_BASE_URL=http://192.168.1.24:3000`
  /// so the same build can target an emulator or a physical phone.
  static String defaultBaseUrl() {
    const fromEnvironment = String.fromEnvironment('SMARTPOSTURE_BASE_URL');
    if (fromEnvironment.isNotEmpty) {
      return fromEnvironment;
    }
    // 10.0.2.2 is the Android Emulator's alias for the host computer.
    // On a physical device replace this with the computer's LAN IP.
    return 'http://10.0.2.2:3000';
  }

  // --- Health -------------------------------------------------------------

  Future<Map<String, dynamic>> health() async {
    final data = await _get<Map<String, dynamic>>('/health', raw: true);
    return data;
  }

  // --- Dashboard ----------------------------------------------------------

  /// Current posture + day summary in a single round trip.
  Future<DashboardView> getDashboard({String? deviceId}) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/dashboard', query: _deviceQuery(deviceId));
    return DashboardView.fromJson(data);
  }

  Future<CurrentPosture> getCurrentPosture({String? deviceId}) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/dashboard/current', query: _deviceQuery(deviceId));
    return CurrentPosture.fromJson(data);
  }

  /// [period] is one of 'day', 'week', 'month'.
  Future<DashboardSummary> getSummary({String period = 'day', String? deviceId}) async {
    final data = await _get<Map<String, dynamic>>(
      '/api/v1/dashboard/summary',
      query: {'period': period, ..._deviceQuery(deviceId)},
    );
    return DashboardSummary.fromJson(data);
  }

  // --- Devices ------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getDevices() async {
    final data = await _get<Map<String, dynamic>>('/api/v1/devices');
    return (data['devices'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getDeviceStatus(String deviceId) async {
    return _get<Map<String, dynamic>>('/api/v1/devices/$deviceId/status');
  }

  // --- History ------------------------------------------------------------

  Future<Paged<TelemetryRecord>> getHistory({
    int page = 1,
    int limit = 20,
    String? deviceId,
    PostureLabel? posture,
    bool? alert,
    DateTime? from,
    DateTime? to,
    String sort = 'desc',
  }) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/history', query: {
      'page': page,
      'limit': limit,
      'sort': sort,
      if (deviceId != null) 'deviceId': deviceId,
      if (posture != null) 'posture': posture.wireValue,
      if (alert != null) 'alert': alert,
      if (from != null) 'from': from.toUtc().toIso8601String(),
      if (to != null) 'to': to.toUtc().toIso8601String(),
    });
    return _toPaged(data, TelemetryRecord.fromJson);
  }

  // --- Sessions -----------------------------------------------------------

  Future<Paged<SessionRecord>> getSessions({
    int page = 1,
    int limit = 20,
    String? deviceId,
    String? status, // 'active' | 'ended'
  }) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/sessions', query: {
      'page': page,
      'limit': limit,
      if (deviceId != null) 'deviceId': deviceId,
      if (status != null) 'status': status,
    });
    return _toPaged(data, SessionRecord.fromJson);
  }

  /// Starts a monitoring session. If one is already active the backend returns
  /// it (with status 200) instead of creating a duplicate.
  Future<SessionRecord> startSession({required String deviceId, DateTime? startedAt, String? notes}) async {
    final data = await _post<Map<String, dynamic>>('/api/v1/sessions', body: {
      'deviceId': deviceId,
      if (startedAt != null) 'startedAt': startedAt.toUtc().toIso8601String(),
      if (notes != null) 'notes': notes,
    });
    return SessionRecord.fromJson(data);
  }

  Future<SessionRecord> getSession(String id) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/sessions/$id');
    return SessionRecord.fromJson(data);
  }

  /// Ends the session and freezes its statistics.
  Future<SessionRecord> endSession(String id, {DateTime? endedAt, String? notes}) async {
    final data = await _patch<Map<String, dynamic>>('/api/v1/sessions/$id/end', body: {
      if (endedAt != null) 'endedAt': endedAt.toUtc().toIso8601String(),
      if (notes != null) 'notes': notes,
    });
    return SessionRecord.fromJson(data);
  }

  // --- Events -------------------------------------------------------------

  Future<Paged<PostureEventRecord>> getEvents({
    int page = 1,
    int limit = 20,
    String? deviceId,
    String? type,
    String? severity,
  }) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/events', query: {
      'page': page,
      'limit': limit,
      if (deviceId != null) 'deviceId': deviceId,
      if (type != null) 'type': type,
      if (severity != null) 'severity': severity,
    });
    return _toPaged(data, PostureEventRecord.fromJson);
  }

  // --- AI recommendations (optional; needs GEMINI_API_KEY on the server) ---

  Future<Recommendation> requestRecommendations({String period = 'day', String? deviceId, bool refresh = false}) async {
    final data = await _post<Map<String, dynamic>>('/api/v1/ai/recommendations', body: {
      'period': period,
      if (deviceId != null) 'deviceId': deviceId,
      'refresh': refresh,
    });
    return Recommendation.fromJson(data);
  }

  Future<Recommendation> getLatestRecommendation({String period = 'day', String? deviceId}) async {
    final data = await _get<Map<String, dynamic>>('/api/v1/ai/recommendations/latest', query: {
      'period': period,
      ..._deviceQuery(deviceId),
    });
    return Recommendation.fromJson(data);
  }

  // --- Internals ----------------------------------------------------------

  Map<String, dynamic> _deviceQuery(String? deviceId) => deviceId == null ? {} : {'deviceId': deviceId};

  List<Map<String, dynamic>> _items(Map<String, dynamic> data) =>
      (data['items'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();

  Paged<T> _toPaged<T>(Map<String, dynamic> data, T Function(Map<String, dynamic>) fromJson) {
    final items = _items(data).map(fromJson).toList();
    final meta = data['meta'] as Map<String, dynamic>? ?? const {};
    return Paged<T>(
      items: items,
      page: (meta['page'] as num?)?.toInt() ?? 1,
      limit: (meta['limit'] as num?)?.toInt() ?? items.length,
      total: (meta['total'] as num?)?.toInt() ?? items.length,
      totalPages: (meta['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  /// Unwraps `{ success, message, data }` and converts failures into [ApiException].
  T _unwrap<T>(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic> && body['success'] == true) {
      return body['data'] as T;
    }
    throw ApiException(
      code: 'INVALID_RESPONSE',
      message: 'Unexpected response shape from the server',
      statusCode: response.statusCode,
    );
  }

  ApiException _toApiException(DioException error) {
    final response = error.response;
    final body = response?.data;
    if (body is Map<String, dynamic>) {
      final errorBody = body['error'] as Map<String, dynamic>?;
      return ApiException(
        code: errorBody?['code'] as String? ?? 'HTTP_${response?.statusCode ?? 0}',
        message: body['message'] as String? ?? error.message ?? 'Request failed',
        statusCode: response?.statusCode,
        details: errorBody?['details'],
      );
    }
    return ApiException(
      code: 'NETWORK_ERROR',
      message: error.message ?? 'Could not reach the SmartPosture server',
      statusCode: response?.statusCode,
    );
  }

  Future<T> _get<T>(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    try {
      final response = await _dio.get<dynamic>(path, queryParameters: query);
      return raw ? response.data as T : _unwrap<T>(response);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  Future<T> _post<T>(String path, {Object? body}) async {
    try {
      final response = await _dio.post<dynamic>(path, data: body);
      return _unwrap<T>(response);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  Future<T> _patch<T>(String path, {Object? body}) async {
    try {
      final response = await _dio.patch<dynamic>(path, data: body);
      return _unwrap<T>(response);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }
}

// ===========================================================================
// Usage
// ===========================================================================
//
// void main() async {
//   final api = SmartPostureApi(baseUrl: 'http://10.0.2.2:3000');
//   try {
//     final dashboard = await api.getDashboard();
//     if (dashboard.summary.hasData) {
//       print('Good posture: ${dashboard.summary.totals.goodPosturePercentage}%');
//     } else {
//       print(dashboard.summary.message); // explicit empty state, no fake numbers
//     }
//   } on ApiException catch (error) {
//     if (error.isOffline) {
//       print('Server unreachable - the wearable keeps working on its own');
//     } else {
//       print('${error.code}: ${error.message}');
//     }
//   }
// }
//
// ===========================================================================
// OPTIONAL real-time updates (Socket.IO). Requires `socket_io_client`.
//
// REST keeps working when this is not connected.
// ===========================================================================
//
// import 'package:socket_io_client/socket_io_client.dart' as io;
//
// class SmartPostureRealtime {
//   SmartPostureRealtime(this.baseUrl);
//
//   final String baseUrl;
//   io.Socket? _socket;
//
//   void connect({
//     void Function(Map<String, dynamic> payload)? onPostureUpdate,
//     void Function(Map<String, dynamic> payload)? onDeviceStatus,
//     void Function(Map<String, dynamic> payload)? onPostureAlert,
//   }) {
//     _socket = io.io(baseUrl, io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().build());
//
//     _socket!
//       ..onConnect((_) => print('live updates connected'))
//       ..onDisconnect((_) => print('live updates disconnected'))
//       ..on('posture:update', (data) => onPostureUpdate?.call(Map<String, dynamic>.from(data as Map)))
//       ..on('device:status', (data) => onDeviceStatus?.call(Map<String, dynamic>.from(data as Map)))
//       ..on('posture:alert', (data) => onPostureAlert?.call(Map<String, dynamic>.from(data as Map)))
//       ..connect();
//   }
//
//   void dispose() {
//     _socket?.dispose();
//     _socket = null;
//   }
// }
