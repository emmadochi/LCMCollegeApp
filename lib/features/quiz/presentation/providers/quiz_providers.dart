import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/quiz_model.dart';
import '../../data/repositories/quiz_repository.dart';

final quizRepositoryProvider = Provider<QuizRepository>((ref) => QuizRepository());

final quizByLessonProvider = FutureProvider.family<QuizModel?, String>((ref, lessonId) async {
  return ref.watch(quizRepositoryProvider).getQuizByLessonId(lessonId);
});
