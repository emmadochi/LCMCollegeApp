import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';
import '../providers/shared_prefs_provider.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(sharedPrefsProvider));
});

class ApiClient {
  final SharedPreferences _prefs;

  ApiClient(this._prefs);

  /**
   * Safe GET request with automatic Authorization header injection
   */
  Future<http.Response> get(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('${ApiConstants.baseUrl}$path').replace(queryParameters: queryParams);
    final headers = _buildHeaders();
    return await http.get(uri, headers: headers);
  }

  /**
   * Safe POST request with automatic body JSON encoding and Authorization header injection
   */
  Future<http.Response> post(String path, {Object? body}) async {
    final uri = Uri.parse('${ApiConstants.baseUrl}$path');
    final headers = _buildHeaders();
    return await http.post(
      uri,
      headers: headers,
      body: jsonEncode(body),
    );
  }

  /**
   * Private helper to compile request headers
   */
  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json; charset=UTF-8',
    };
    final token = _prefs.getString('token');
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }
}
