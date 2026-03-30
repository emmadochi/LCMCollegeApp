import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/course_model.dart';
import '../../data/repositories/course_repository.dart';
import '../../../learning/data/repositories/learning_repository.dart';
import '../../data/models/category_model.dart';
import '../../data/repositories/category_repository.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

final courseRepositoryProvider = Provider<CourseRepository>((ref) => CourseRepository());
final learningRepositoryProvider = Provider<LearningRepository>((ref) => LearningRepository());
final categoryRepositoryProvider = Provider<CategoryRepository>((ref) => CategoryRepository());

final categoriesProvider = StreamProvider<List<CategoryModel>>((ref) {
  return ref.watch(categoryRepositoryProvider).getCategories();
});

final searchQueryProvider = StateProvider<String>((ref) => '');
final selectedCategoryProvider = StateProvider<String?>((ref) => null);

final allCoursesProvider = StreamProvider<List<CourseModel>>((ref) {
  return ref.watch(courseRepositoryProvider).getCourses();
});

final filteredCoursesProvider = Provider<AsyncValue<List<CourseModel>>>((ref) {
  final allCoursesAsync = ref.watch(allCoursesProvider);
  final searchQuery = ref.watch(searchQueryProvider).toLowerCase();
  final selectedCategory = ref.watch(selectedCategoryProvider);

  return allCoursesAsync.whenData((courses) {
    return courses.where((course) {
      final matchesSearch = course.title.toLowerCase().contains(searchQuery) ||
          course.description.toLowerCase().contains(searchQuery);
      final matchesCategory = selectedCategory == null || course.category == selectedCategory;
      return matchesSearch && matchesCategory;
    }).toList();
  });
});

final enrolledCoursesProvider = FutureProvider<List<CourseModel>>((ref) async {
  final user = ref.watch(currentUserProvider).value;
  if (user == null || user.enrolledCourses.isEmpty) return [];

  final repo = ref.watch(courseRepositoryProvider);
  final courses = await Future.wait(
    user.enrolledCourses.map((id) => repo.getCourseById(id)),
  );
  return courses;
});

final courseProgressProvider = StreamProvider.family<double, String>((ref, courseId) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null) return Stream.value(0.0);

  final learningRepo = ref.watch(learningRepositoryProvider);
  final courseRepo = ref.watch(courseRepositoryProvider);

  return learningRepo.getUserProgress(user.id, courseId).asyncMap((progressList) async {
    try {
      final course = await courseRepo.getCourseById(courseId);
      if (course.totalLessons == 0) return 0.0;
      
      final completedLessons = progressList.where((p) => p.isCompleted).length;
      return completedLessons / course.totalLessons;
    } catch (e) {
      return 0.0;
    }
  });
});

final completedCoursesProvider = FutureProvider<List<CourseModel>>((ref) async {
  final user = ref.watch(currentUserProvider).value;
  if (user == null || user.completedCourses.isEmpty) return [];

  final repo = ref.watch(courseRepositoryProvider);
  final courses = await Future.wait(
    user.completedCourses.map((id) => repo.getCourseById(id)),
  );
  return courses;
});

final courseByIdProvider = FutureProvider.family<CourseModel, String>((ref, courseId) async {
  return ref.watch(courseRepositoryProvider).getCourseById(courseId);
});
