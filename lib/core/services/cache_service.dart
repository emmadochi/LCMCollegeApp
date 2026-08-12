import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  // In-Memory cache map
  static final Map<String, dynamic> _memoryCache = {};

  // Setter for Memory Cache
  void setInMemory(String key, dynamic value) {
    _memoryCache[key] = value;
  }

  // Getter for Memory Cache
  dynamic getFromMemory(String key) {
    return _memoryCache[key];
  }

  // Clear memory cache
  void clearMemory() {
    _memoryCache.clear();
  }

  // Persist JSON data to SharedPreferences and update Memory cache
  Future<void> set(String key, dynamic jsonValue) async {
    _memoryCache[key] = jsonValue;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, jsonEncode(jsonValue));
    } catch (_) {
      // Ignore storage writing errors
    }
  }

  // Retrieve data from memory, falling back to SharedPreferences
  Future<dynamic> get(String key) async {
    if (_memoryCache.containsKey(key)) {
      return _memoryCache[key];
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final stringVal = prefs.getString(key);
      if (stringVal != null) {
        final decoded = jsonDecode(stringVal);
        _memoryCache[key] = decoded;
        return decoded;
      }
    } catch (_) {
      // Ignore reading/decoding errors
    }
    return null;
  }

  // Clear specific cache key
  Future<void> remove(String key) async {
    _memoryCache.remove(key);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    } catch (_) {}
  }
}
