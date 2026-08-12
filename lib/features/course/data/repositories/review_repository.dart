import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/services/cache_service.dart';
import '../models/review_model.dart';

class ReviewRepository {
  ReviewRepository();

  Stream<List<ReviewModel>> getCourseReviews(String courseId) async* {
    final cached = await CacheService().get('course_reviews_$courseId');
    if (cached != null) {
      yield (cached as List).map((json) => ReviewModel.fromMap(json, json['id'] ?? '')).toList();
    }
    try {
      final fresh = await _fetchCourseReviews(courseId);
      await CacheService().set('course_reviews_$courseId', fresh.map((e) => e.toMap()).toList());
      yield fresh;
    } catch (e) {
      if (cached == null) rethrow;
    }
  }

  Future<List<ReviewModel>> _fetchCourseReviews(String courseId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.reviews}').replace(queryParameters: {'course_id': courseId});
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => ReviewModel.fromMap(json, json['id'] ?? '')).toList();
      } else {
        throw Exception('Failed to load reviews: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch reviews: $e');
    }
  }

  Future<void> addReview(ReviewModel review) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.reviews}');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');

      final headers = <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final body = {
        'courseId': review.courseId,
        'courseName': review.courseName,
        'rating': review.rating.toInt(),
        'comment': review.comment,
      };

      final response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode(body),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        await CacheService().remove('course_reviews_${review.courseId}');
      } else {
        final responseData = jsonDecode(response.body);
        throw Exception(responseData['message'] ?? 'Failed to submit review');
      }
    } catch (e) {
      throw Exception('Submit review failed: $e');
    }
  }
}
