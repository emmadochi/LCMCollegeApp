import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/assignment_model.dart';
import '../../data/repositories/assignment_repository.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

final assignmentRepositoryProvider = Provider<AssignmentRepository>((ref) => AssignmentRepository());

final lessonAssignmentProvider = StreamProvider.family<AssignmentModel?, String>((ref, lessonId) {
  return ref.watch(assignmentRepositoryProvider).getAssignmentForLesson(lessonId);
});

final userSubmissionProvider = StreamProvider.family<SubmissionModel?, String>((ref, assignmentId) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null) return Stream.value(null);
  return ref.watch(assignmentRepositoryProvider).getUserSubmission(assignmentId, user.id);
});
