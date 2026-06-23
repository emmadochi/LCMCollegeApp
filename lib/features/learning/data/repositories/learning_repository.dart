import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/api_constants.dart';
import '../models/lesson_model.dart';
import '../models/progress_model.dart';

class LearningRepository {
  LearningRepository();

  Stream<List<LessonModel>> getLessons(String courseId) {
    return Stream.fromFuture(_fetchLessons(courseId));
  }

  Future<List<LessonModel>> _fetchLessons(String courseId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.lessons}').replace(queryParameters: {'course_id': courseId});
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final lessons = data.map((json) => LessonModel.fromMap(json, json['id'] ?? '')).toList();
        lessons.sort((a, b) => a.order.compareTo(b.order));
        return lessons;
      } else {
        throw Exception('Failed to load lessons: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch lessons: $e');
    }
  }

  Future<void> updateProgress(ProgressModel progress) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.progress}');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode(progress.toMap()),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        final data = jsonDecode(response.body);
        throw Exception(data['message'] ?? 'Failed to update progress');
      }
    } catch (e) {
      throw Exception('Update progress failed: $e');
    }
  }

  Stream<List<ProgressModel>> getUserProgress(String userId, String courseId) {
    return Stream.fromFuture(_fetchUserProgress(userId, courseId));
  }

  Future<List<ProgressModel>> _fetchUserProgress(String userId, String courseId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.progress}').replace(queryParameters: {
        'user_id': userId,
        'course_id': courseId,
      });
      
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => ProgressModel.fromMap(json)).toList();
      } else {
        throw Exception('Failed to load user progress: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch user progress: $e');
    }
  }

  Future<LessonModel?> getLessonById(String lessonId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.lessons}').replace(queryParameters: {'id': lessonId});
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        return LessonModel.fromMap(data, data['id'] ?? lessonId);
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  Future<void> requestCertificate(String userId, String courseId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.certificate}');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode({
          'courseId': courseId,
        }),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        final data = jsonDecode(response.body);
        throw Exception(data['message'] ?? 'Failed to submit certificate request');
      }
    } catch (e) {
      throw Exception('Certificate request failed: $e');
    }
  }
}
