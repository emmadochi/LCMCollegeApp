import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/api_constants.dart';
import '../models/quiz_model.dart';

class QuizRepository {
  QuizRepository();

  Future<QuizModel?> getQuizByLessonId(String lessonId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.quizzes}').replace(queryParameters: {'lesson_id': lessonId});
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data == null) return null;
        return QuizModel.fromMap(data, data['id'] ?? '');
      } else {
        throw Exception('Failed to load quiz: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch quiz: $e');
    }
  }

  Future<void> submitQuizResult({
    required String userId,
    required String courseId,
    required String lessonId,
    required int score,
  }) async {
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

      final body = {
        'userId': userId,
        'courseId': courseId,
        'lessonId': lessonId,
        'lastQuizScore': score,
        'isCompleted': score >= 70, // Pass mark standard threshold
        'attempts': 1 // Add basic attempt increment
      };

      final response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode(body),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        final responseData = jsonDecode(response.body);
        throw Exception(responseData['message'] ?? 'Failed to submit quiz result');
      }
    } catch (e) {
      throw Exception('Quiz submission failed: $e');
    }
  }
}
