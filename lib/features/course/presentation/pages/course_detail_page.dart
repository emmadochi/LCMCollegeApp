import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../learning/data/models/lesson_model.dart';
import '../../../learning/data/models/progress_model.dart';
import '../../../learning/data/repositories/learning_repository.dart';
import '../../../learning/presentation/pages/lesson_player_screen.dart';
import '../../data/models/course_model.dart';
import '../../data/repositories/course_repository.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/review_model.dart';
import '../providers/review_providers.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'admin_course_edit_page.dart';

class CourseDetailPage extends ConsumerWidget {
  final String courseId;
  const CourseDetailPage({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider).value;
    final isEnrolled = user?.enrolledCourses.contains(courseId) ?? false;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('LCM College', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary)),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Symbols.notifications)),
        ],
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: FirebaseFirestore.instance.collection('courses').doc(courseId).snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snapshot.hasData || !snapshot.data!.exists) {
            return const Center(child: Text("Course not found"));
          }
          
          final courseData = snapshot.data!.data() as Map<String, dynamic>;
          final course = CourseModel.fromMap(courseData, snapshot.data!.id);

          return StreamBuilder<List<LessonModel>>(
            stream: LearningRepository().getLessons(courseId),
            builder: (context, lessonSnapshot) {
              if (lessonSnapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              final lessons = lessonSnapshot.data ?? [];

              return StreamBuilder<List<ProgressModel>>(
                stream: isEnrolled ? LearningRepository().getUserProgress(user!.id, courseId) : Stream.value([]),
                builder: (context, progressSnapshot) {
                  final progressList = progressSnapshot.data ?? [];
                  final completedLessonIds = progressList.where((p) => p.isCompleted).map((p) => p.lessonId).toSet();
                  
                  // Calculate progress percentage
                  final progressPercent = lessons.isEmpty ? 0 : (completedLessonIds.length / lessons.length * 100).toInt();

                  // Find next lesson to resume
                  LessonModel? nextLesson;
                  if (isEnrolled && lessons.isNotEmpty) {
                    for (final lesson in lessons) {
                      if (!completedLessonIds.contains(lesson.id)) {
                        nextLesson = lesson;
                        break;
                      }
                    }
                  }

                  return RefreshIndicator(
                    onRefresh: () async {
                      ref.invalidate(currentUserProvider);
                      ref.invalidate(courseReviewsProvider(courseId));
                      await ref.read(currentUserProvider.future);
                      await ref.read(courseReviewsProvider(courseId).future);
                    },
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 16),
                          // Overall Progress Indicator (RESTORED TO TOP)
                          if (isEnrolled) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Overall Progress', style: TextStyle(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
                                Text('$progressPercent%', style: TextStyle(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.secondary)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: progressPercent / 100, 
                                backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest, 
                                valueColor: AlwaysStoppedAnimation(Theme.of(context).colorScheme.secondary),
                              ),
                            ),
                          ],
                          const SizedBox(height: 32),
                          // Hero
                          ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: Stack(
                              children: [
                                Image.network(
                                  course.thumbnailUrl.isNotEmpty ? course.thumbnailUrl : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070',
                                  height: 200,
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                ),
                                Positioned.fill(child: Container(decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.black.withOpacity(0.8), Colors.transparent], begin: Alignment.bottomCenter, end: Alignment.topCenter)))),
                                Positioned(bottom: 24, left: 24, child: Text(course.title, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold))),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Resume Learning Card
                          if (isEnrolled && nextLesson != null) ...[
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.primaryContainer],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                                    blurRadius: 12,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('NEXT LESSON', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.7), letterSpacing: 1.2)),
                                        const SizedBox(height: 4),
                                        Text(nextLesson.title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onPrimary)),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => LessonPlayerScreen(lesson: nextLesson!),
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Theme.of(context).colorScheme.onPrimary,
                                      foregroundColor: Theme.of(context).colorScheme.primary,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                    child: const Text('Resume'),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),
                          ],
                          
                          // Stats
                          GridView.count(
                            crossAxisCount: 2,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            mainAxisSpacing: 16,
                            crossAxisSpacing: 16,
                            childAspectRatio: 2.5,
                            children: [
                              _StatCard(icon: Symbols.menu_book, label: 'Lessons', value: '${course.totalLessons} Modules'),
                              _StatCard(icon: Symbols.schedule, label: 'Duration', value: course.duration),
                              _StatCard(icon: Symbols.quiz, label: 'Assessments', value: course.hasQuizzes ? 'Quizzes included' : 'No quizzes'),
                              _StatCard(icon: Symbols.trending_up, label: 'Category', value: course.category),
                            ],
                          ),
                          const SizedBox(height: 48),
                          // Course Description
                          Text('About this Course', style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
                          const SizedBox(height: 16),
                          Text(
                            course.description.isNotEmpty ? course.description : 'No description available for this course.',
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                              height: 1.6,
                            ),
                          ),
                          const SizedBox(height: 48),
                          // Curriculum
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Curriculum', style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
                              if (user?.isAdmin ?? false)
                                ElevatedButton.icon(
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => AdminCourseEditPage(course: course),
                                      ),
                                    );
                                  },
                                  icon: const Icon(Symbols.edit, size: 18),
                                  label: const Text('Edit Course'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Theme.of(context).colorScheme.secondary,
                                    foregroundColor: Theme.of(context).colorScheme.onSecondary,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          if (lessons.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 24),
                              child: Center(child: Text("No lessons available for this course yet.")),
                            )
                          else
                            Column(
                              children: lessons.asMap().entries.map((entry) {
                                final index = entry.key;
                                final lesson = entry.value;
                                
                                TimelineStatus status = TimelineStatus.locked;
                                if (!isEnrolled) {
                                  status = TimelineStatus.locked;
                                } else if (completedLessonIds.contains(lesson.id)) {
                                  status = TimelineStatus.completed;
                                } else if (nextLesson?.id == lesson.id) {
                                  status = TimelineStatus.inProgress;
                                } else {
                                  status = TimelineStatus.locked;
                                }

                                return _TimelineItem(
                                  module: 'Lesson ${index + 1}',
                                  title: lesson.title,
                                  description: 'Topic: ${lesson.title}',
                                  status: status,
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => LessonPlayerScreen(lesson: lesson),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          
                          if (!isEnrolled) ...[
                            const SizedBox(height: 32),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: () async {
                                  if (user == null) {
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please login to enrol')));
                                    return;
                                  }
                                  try {
                                    await ref.read(authRepositoryProvider).enrollInCourse(user.id, courseId);
                                    // Refresh current user to update UI
                                    ref.invalidate(currentUserProvider);
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Successfully enrolled!')));
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                                    }
                                  }
                                },
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  backgroundColor: Theme.of(context).colorScheme.primary,
                                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                                ),
                                child: const Text('Enrol Now', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                          const SizedBox(height: 48),
                          // Reviews
                          _ReviewsSection(courseId: courseId, courseName: course.title),
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _ReviewsSection extends ConsumerWidget {
  final String courseId;
  final String courseName;
  const _ReviewsSection({required this.courseId, required this.courseName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(courseReviewsProvider(courseId));
    final user = ref.watch(currentUserProvider).value;
    final isEnrolled = user?.enrolledCourses.contains(courseId) ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Student Reviews', style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
            if (isEnrolled)
              TextButton.icon(
                onPressed: () => _showReviewDialog(context, ref, user!, courseId, courseName),
                icon: const Icon(Symbols.rate_review, size: 18),
                label: const Text('Write Review'),
              ),
          ],
        ),
        const SizedBox(height: 16),
        reviewsAsync.when(
          data: (reviews) {
            if (reviews.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text("No reviews yet. Be the first to review!")),
              );
            }
            return Column(
              children: reviews.map((review) => _ReviewItem(review: review)).toList(),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Text('Error: $err'),
        ),
      ],
    );
  }

  void _showReviewDialog(BuildContext context, WidgetRef ref, dynamic user, String courseId, String courseName) {
    double rating = 5.0;
    final commentController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 32,
          top: 32,
          left: 24,
          right: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Rate this course', style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Share your experience with other students', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5))),
            const SizedBox(height: 24),
            Center(
              child: RatingBar.builder(
                initialRating: 5,
                minRating: 1,
                direction: Axis.horizontal,
                allowHalfRating: true,
                itemCount: 5,
                itemPadding: const EdgeInsets.symmetric(horizontal: 4.0),
                itemBuilder: (context, _) => const Icon(Symbols.star, color: Colors.amber, fill: 1),
                onRatingUpdate: (r) => rating = r,
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: commentController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Write your comment here...',
                filled: true,
                fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  final review = ReviewModel(
                    id: '',
                    courseId: courseId,
                    courseName: courseName,
                    userId: user.id,
                    userName: user.fullName,
                    userEmail: user.email,
                    rating: rating,
                    comment: commentController.text,
                    createdAt: DateTime.now(),
                  );
                  try {
                    await ref.read(reviewRepositoryProvider).addReview(review);
                    if (context.mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Review submitted!')));
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text('Submit Review', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewItem extends StatelessWidget {
  final ReviewModel review;
  const _ReviewItem({required this.review});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(review.userName, style: const TextStyle(fontWeight: FontWeight.bold)),
              Row(
                children: [
                  const Icon(Symbols.star, color: Colors.amber, size: 16, fill: 1),
                  const SizedBox(width: 4),
                  Text(review.rating.toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(review.comment, style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 13)),
          const SizedBox(height: 8),
          Text(
            '${review.createdAt.day}/${review.createdAt.month}/${review.createdAt.year}',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.35), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatCard({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh, 
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.secondary, size: 24),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4))),
              Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }
}

enum TimelineStatus { completed, inProgress, locked }

class _TimelineItem extends StatelessWidget {
  final String module;
  final String title;
  final String description;
  final TimelineStatus status;
  final VoidCallback onTap;

  const _TimelineItem({required this.module, required this.title, required this.description, required this.status, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: status == TimelineStatus.completed ? Theme.of(context).colorScheme.secondary : (status == TimelineStatus.inProgress ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  status == TimelineStatus.completed ? Symbols.check : (status == TimelineStatus.inProgress ? Symbols.play_arrow : Symbols.lock),
                  color: status == TimelineStatus.locked ? Theme.of(context).colorScheme.onSurface.withOpacity(0.4) : Colors.white,
                  size: 18,
                  fill: 1,
                ),
              ),
              Expanded(child: Container(width: 2, color: Theme.of(context).colorScheme.outlineVariant)),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GestureDetector(
              onTap: status == TimelineStatus.locked ? null : onTap,
              child: Container(
                margin: const EdgeInsets.only(bottom: 24),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(16),
                  border: status == TimelineStatus.inProgress ? Border.all(color: Theme.of(context).colorScheme.primary, width: 2) : null,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(module.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: status == TimelineStatus.locked ? Theme.of(context).colorScheme.onSurface.withOpacity(0.4) : Theme.of(context).colorScheme.secondary)),
                        if (status == TimelineStatus.inProgress)
                          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(4)), child: Text('IN PROGRESS', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary))),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: status == TimelineStatus.locked ? Theme.of(context).colorScheme.onSurface.withOpacity(0.4) : Theme.of(context).colorScheme.onSurface)),
                    const SizedBox(height: 4),
                    Text(description, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                    if (status == TimelineStatus.inProgress) ...[
                      const SizedBox(height: 16),
                      SizedBox(width: double.infinity, child: ElevatedButton(onPressed: onTap, child: const Text('Resume Learning'))),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
