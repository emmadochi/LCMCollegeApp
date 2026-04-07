import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../course/presentation/providers/course_providers.dart';
import '../../../course/data/models/course_model.dart';
import '../../../course/presentation/pages/course_detail_page.dart';
import '../pages/lesson_player_screen.dart';
import '../../data/repositories/learning_repository.dart';
import '../../data/models/lesson_model.dart';

class MyCoursesPage extends ConsumerWidget {
  const MyCoursesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider).value;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('LCM College', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary)),
        actions: [
          IconButton(onPressed: () {}, icon: Icon(Symbols.notifications, color: Theme.of(context).colorScheme.primary)),
        ],
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: CircleAvatar(
            backgroundImage: user?.profileImageUrl != null && user!.profileImageUrl!.isNotEmpty 
              ? NetworkImage(user.profileImageUrl!) 
              : null,
            child: (user?.profileImageUrl == null || user!.profileImageUrl!.isEmpty)
              ? const Icon(Symbols.person, size: 20)
              : null,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(currentUserProvider);
          ref.invalidate(enrolledCoursesProvider);
          ref.invalidate(completedCoursesProvider);
          await ref.read(enrolledCoursesProvider.future);
          await ref.read(completedCoursesProvider.future);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('PERSONAL DASHBOARD', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.secondary, letterSpacing: 1.2)),
                  const SizedBox(height: 4),
                  Text('Welcome back, ${user?.fullName ?? 'Alex'}!', style: GoogleFonts.manrope(fontSize: 28, fontWeight: FontWeight.w800)),
                  Text('You have 3 active assignments due this week.', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6), fontSize: 14)),
                ],
              ),
              const SizedBox(height: 32),
              // Continue Learning Card
              const _ContinueLearningCard(),
              const SizedBox(height: 40),
              // Enrolled Courses
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Enrolled Courses', style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.bold)),
                  TextButton(onPressed: () {}, child: const Text('View All')),
                ],
              ),
              const SizedBox(height: 16),
              ref.watch(enrolledCoursesProvider).when(
                data: (courses) {
                  if (courses.isEmpty) {
                    return const Center(child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Text('You are not enrolled in any courses yet.'),
                    ));
                  }
                  return GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    childAspectRatio: 0.85,
                    children: courses.map((course) => _EnrolledCourseCard(
                      course: course,
                    )).toList(),
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Error: $e')),
              ),
              const SizedBox(height: 40),
              // Completed
              Text('COMPLETED', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4), letterSpacing: 1.2)),
              const SizedBox(height: 16),
              ref.watch(completedCoursesProvider).when(
                data: (courses) {
                  if (courses.isEmpty) {
                    return Text('No completed courses yet.', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4), fontSize: 12));
                  }
                  return SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: courses.map((course) => Padding(
                        padding: const EdgeInsets.only(right: 16),
                        child: _CompletedCourseThumb(
                          title: course.title,
                          imageUrl: course.thumbnailUrl.isNotEmpty ? course.thumbnailUrl : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070',
                        ),
                      )).toList(),
                    ),
                  );
                },
                loading: () => const SizedBox(),
                error: (_, __) => const SizedBox(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ContinueLearningCard extends ConsumerWidget {
  const _ContinueLearningCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enrolledCourses = ref.watch(enrolledCoursesProvider).value ?? [];
    if (enrolledCourses.isEmpty) return const SizedBox();

    final course = enrolledCourses.first; // Pick first for now
    final progress = ref.watch(courseProgressProvider(course.id)).value ?? 0.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.primaryContainer,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: const Text('CONTINUE LEARNING', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          ),
          const SizedBox(height: 16),
          Text(course.title, style: GoogleFonts.manrope(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
          Text(course.category, style: const TextStyle(color: Colors.white70, fontSize: 14)),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Current Progress', style: TextStyle(color: Colors.white60, fontSize: 12)),
              Text('${(progress * 100).toInt()}%', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress, 
              backgroundColor: Colors.white.withOpacity(0.12),
              valueColor: AlwaysStoppedAnimation(Theme.of(context).colorScheme.secondary),
            ),
          ),
          const SizedBox(height: 24),
          StreamBuilder<List<LessonModel>>(
            stream: LearningRepository().getLessons(course.id),
            builder: (context, snapshot) {
              if (!snapshot.hasData || snapshot.data!.isEmpty) return const SizedBox();
              return ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => LessonPlayerScreen(lesson: snapshot.data!.first),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.secondary, 
                  foregroundColor: Theme.of(context).colorScheme.onSecondary, 
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                icon: const Icon(Symbols.play_circle, fill: 1),
                label: const Text('Resume Lesson'),
              );
            }
          ),
        ],
      ),
    );
  }
}

class _EnrolledCourseCard extends ConsumerWidget {
  final CourseModel course;

  const _EnrolledCourseCard({required this.course});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(courseProgressProvider(course.id)).value ?? 0.0;
    
    // Choose a color based on category or index
    final color = course.category.toLowerCase().contains('bus') ? Colors.indigo : Colors.teal;
    final icon = course.category.toLowerCase().contains('bus') ? Symbols.payments : Symbols.database;

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CourseDetailPage(courseId: course.id),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  course.title, 
                  style: TextStyle(
                    fontWeight: FontWeight.bold, 
                    fontSize: 16,
                    color: Theme.of(context).colorScheme.onSurface,
                  ), 
                  maxLines: 1, 
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  course.category, 
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6), 
                    fontSize: 12,
                  ), 
                  maxLines: 1, 
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Progress', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
                    Text(
                      '${(progress * 100).toInt()}%', 
                      style: TextStyle(
                        fontSize: 10, 
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress, 
                    backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest, 
                    valueColor: AlwaysStoppedAnimation(color),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CompletedCourseThumb extends StatelessWidget {
  final String title;
  final String imageUrl;

  const _CompletedCourseThumb({required this.title, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: ColorFiltered(
                colorFilter: const ColorFilter.mode(Colors.grey, BlendMode.saturation),
                child: Image.network(imageUrl, width: 80, height: 80, fit: BoxFit.cover),
              ),
            ),
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.secondary.withOpacity(0.4), 
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Symbols.check_circle, color: Colors.white, fill: 1),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: 80, 
          child: Text(
            title, 
            style: TextStyle(
              fontSize: 10, 
              fontWeight: FontWeight.bold,
              color: Theme.of(context).colorScheme.onSurface,
            ), 
            textAlign: TextAlign.center, 
            maxLines: 1, 
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
