import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/api_constants.dart';
import '../models/course_model.dart';

class CourseRepository {
  CourseRepository();

  Stream<List<CourseModel>> getCourses() {
    return Stream.fromFuture(_fetchCoursesList());
  }

  Stream<List<CourseModel>> getFeaturedCourses() {
    return Stream.fromFuture(_fetchCoursesList(queryParams: {'featured': 'true'}));
  }

  Stream<List<CourseModel>> getCoursesByCategory(String category) {
    return Stream.fromFuture(_fetchCoursesList(queryParams: {'category': category}));
  }

  Future<List<CourseModel>> _fetchCoursesList({Map<String, String>? queryParams}) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.courses}').replace(queryParameters: queryParams);
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => CourseModel.fromMap(json, json['id'] ?? '')).toList();
      } else {
        throw Exception('Failed to load courses: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch courses: $e');
    }
  }

  Future<CourseModel> getCourseById(String courseId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.courses}').replace(queryParameters: {'id': courseId});
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        return CourseModel.fromMap(data, data['id'] ?? courseId);
      } else {
        throw Exception('Course not found');
      }
    } catch (e) {
      throw Exception('Failed to fetch course detail: $e');
    }
  }

  Future<void> updateCourse(CourseModel course) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}/admin/courses.php');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      
      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final body = {
        'action': 'update',
        'id': course.id,
        'title': course.title,
        'description': course.description,
        'category': course.category,
        'duration': course.duration,
        'rating': course.rating,
        'isFeatured': course.isFeatured,
        'hasQuizzes': course.hasQuizzes,
        'thumbnailUrl': course.thumbnailUrl,
      };

      final response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode(body),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        final responseData = jsonDecode(response.body);
        throw Exception(responseData['message'] ?? 'Failed to update course');
      }
    } catch (e) {
      throw Exception('Update course failed: $e');
    }
  }
}
