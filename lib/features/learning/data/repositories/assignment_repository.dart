import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/services/cache_service.dart';
import '../models/assignment_model.dart';

class AssignmentRepository {
  AssignmentRepository();

  Stream<AssignmentModel?> getAssignmentForLesson(String lessonId) async* {
    final cached = await CacheService().get('assignment_$lessonId');
    if (cached != null) {
      yield AssignmentModel.fromMap(cached, cached['id'] ?? '');
    }
    try {
      final fresh = await _fetchAssignment(lessonId);
      if (fresh != null) {
        await CacheService().set('assignment_$lessonId', fresh.toMap());
      }
      yield fresh;
    } catch (e) {
      if (cached == null) rethrow;
    }
  }

  Future<AssignmentModel?> _fetchAssignment(String lessonId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.assignments}').replace(queryParameters: {'lesson_id': lessonId});
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data == null) return null;
        return AssignmentModel.fromMap(data, data['id'] ?? '');
      } else {
        throw Exception('Failed to load assignment: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch assignment: $e');
    }
  }

  Stream<SubmissionModel?> getUserSubmission(String assignmentId, String userId) async* {
    final cached = await CacheService().get('submission_${assignmentId}_$userId');
    if (cached != null) {
      yield SubmissionModel.fromMap(cached, cached['id'] ?? '');
    }
    try {
      final fresh = await _fetchUserSubmission(assignmentId, userId);
      if (fresh != null) {
        await CacheService().set('submission_${assignmentId}_$userId', fresh.toMap());
      }
      yield fresh;
    } catch (e) {
      if (cached == null) rethrow;
    }
  }

  Future<SubmissionModel?> _fetchUserSubmission(String assignmentId, String userId) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.submissions}').replace(queryParameters: {
        'assignment_id': assignmentId,
        'user_id': userId,
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
        final data = jsonDecode(response.body);
        if (data == null) return null;
        return SubmissionModel.fromMap(data, data['id'] ?? '');
      } else {
        throw Exception('Failed to load user submission: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch user submission: $e');
    }
  }

  Future<void> submitAssignment({
    required SubmissionModel submission,
    File? file,
  }) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.submissions}');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');

      if (file != null) {
        // If file upload is needed, use http.MultipartRequest
        final request = http.MultipartRequest('POST', uri);
        if (token != null) {
          request.headers['Authorization'] = 'Bearer $token';
        }

        request.fields['userId'] = submission.userId;
        request.fields['assignmentId'] = submission.assignmentId;
        request.fields['lessonId'] = submission.lessonId;
        request.fields['submissionType'] = submission.submissionType;
        request.fields['text'] = submission.text;
        request.fields['fileName'] = submission.fileName;

        request.files.add(await http.MultipartFile.fromPath('file', file.path));

        final streamedResponse = await request.send();
        final response = await http.Response.fromStream(streamedResponse);

        if (response.statusCode == 200 || response.statusCode == 201) {
          await CacheService().remove('submission_${submission.assignmentId}_${submission.userId}');
        } else {
          final data = jsonDecode(response.body);
          throw Exception(data['message'] ?? 'Failed to submit assignment with file');
        }
      } else {
        // Standard JSON POST
        final headers = <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
        };
        if (token != null) {
          headers['Authorization'] = 'Bearer $token';
        }

        final response = await http.post(
          uri,
          headers: headers,
          body: jsonEncode(submission.toMap()),
        );

        if (response.statusCode == 200 || response.statusCode == 201) {
          await CacheService().remove('submission_${submission.assignmentId}_${submission.userId}');
        } else {
          final data = jsonDecode(response.body);
          throw Exception(data['message'] ?? 'Failed to submit assignment');
        }
      }
    } catch (e) {
      throw Exception('Assignment submission failed: $e');
    }
  }
}
