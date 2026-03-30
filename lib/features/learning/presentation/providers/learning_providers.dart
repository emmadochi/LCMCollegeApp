import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/lesson_model.dart';
import '../../data/repositories/learning_repository.dart';
import '../../../course/presentation/providers/course_providers.dart';

final lessonsByCourseProvider = StreamProvider.family<List<LessonModel>, String>((ref, courseId) {
  return ref.watch(learningRepositoryProvider).getLessons(courseId);
});
