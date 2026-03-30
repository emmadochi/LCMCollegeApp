import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/review_model.dart';
import '../../data/repositories/review_repository.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) => ReviewRepository());

final courseReviewsProvider = StreamProvider.family<List<ReviewModel>, String>((ref, courseId) {
  return ref.watch(reviewRepositoryProvider).getCourseReviews(courseId);
});
