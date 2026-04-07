import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

import '../../../quiz/data/models/quiz_model.dart';
import '../../../quiz/data/repositories/quiz_repository.dart';
import '../../../learning/presentation/providers/learning_providers.dart';
import '../../../learning/presentation/pages/lesson_player_screen.dart';
import '../../../learning/data/models/lesson_model.dart';
import '../../../learning/data/repositories/learning_repository.dart';
import '../../../../features/profile/presentation/pages/certificate_screen.dart';
import '../../../../features/course/presentation/providers/course_providers.dart';
import '../../../../features/course/data/models/course_model.dart';
import 'package:intl/intl.dart';
import '../../../learning/presentation/pages/course_completion_page.dart';

class QuizScreen extends ConsumerStatefulWidget {
  final String courseId;
  final String lessonId;
  const QuizScreen({super.key, required this.courseId, required this.lessonId});

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  int _currentQuestionIndex = 0;
  int? _selectedOptionIndex;
  int _score = 0;
  bool _isFinished = false;

  LessonModel? _lesson;
  List<QuizQuestion> _questions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final lesson = await LearningRepository().getLessonById(widget.lessonId);
    if (mounted) {
      setState(() => _lesson = lesson);
      await _loadQuiz();
    }
  }

  Future<void> _loadQuiz() async {
    final quiz = await QuizRepository().getQuizByLessonId(widget.lessonId);
    if (mounted) {
      setState(() {
        _questions = quiz?.questions ?? [];
        _isLoading = false;
      });
    }
  }

  void _handleSubmit() {
    if (_selectedOptionIndex == null) return;

    if (_selectedOptionIndex == _questions[_currentQuestionIndex].correctAnswerIndex) {
      _score++;
    }

    if (_currentQuestionIndex < _questions.length - 1) {
      setState(() {
        _currentQuestionIndex++;
        _selectedOptionIndex = null;
      });
    } else {
      _finishQuiz();
    }
  }

  Future<void> _finishQuiz() async {
    final percentage = (_score / _questions.length) * 100;
    
    // Get real user ID from provider
    final user = ref.read(currentUserProvider).value;
    final userId = user?.id ?? 'anonymous_user';

    await QuizRepository().submitQuizResult(
      userId: userId,
      courseId: widget.courseId,
      lessonId: widget.lessonId,
      score: percentage.toInt(),
    );
    if (mounted) {
      setState(() {
        _isFinished = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_isFinished) {
      return _ResultView(
        score: _score,
        total: _questions.length,
        courseId: widget.courseId,
        currentLessonId: widget.lessonId,
      );
    }
    if (_questions.isEmpty) {
      return const Scaffold(body: Center(child: Text("No quiz available for this lesson.")));
    }

    final question = _questions[_currentQuestionIndex];
    double progress = (_currentQuestionIndex + 1) / _questions.length;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Symbols.close)),
        title: Text('LCM College', style: GoogleFonts.manrope(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            Text(
              'Lesson ${_lesson?.order ?? ''} Test: ${_lesson?.title ?? ''}', 
              style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary), 
              textAlign: TextAlign.center
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Question ${_currentQuestionIndex + 1} of ${_questions.length}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5))),
                Text('${(progress * 100).toInt()}% Complete', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.secondary)),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress, 
                backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest, 
                valueColor: AlwaysStoppedAnimation(Theme.of(context).colorScheme.secondary),
              ),
            ),
            const SizedBox(height: 48),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(question.question, style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 32),
                  ...List.generate(question.options.length, (index) {
                    bool isSelected = _selectedOptionIndex == index;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedOptionIndex = index),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isSelected ? Theme.of(context).colorScheme.secondary.withOpacity(0.05) : Colors.transparent,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: isSelected ? Theme.of(context).colorScheme.secondary : Theme.of(context).colorScheme.outlineVariant, width: 2),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: isSelected ? Theme.of(context).colorScheme.secondary : Theme.of(context).colorScheme.outlineVariant, width: 2),
                                color: isSelected ? Theme.of(context).colorScheme.secondary : Colors.transparent,
                              ),
                              child: isSelected ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                            ),
                            const SizedBox(width: 16),
                            Expanded(child: Text(question.options[index], style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal))),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _selectedOptionIndex != null ? _handleSubmit : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                ),
                child: const Text('Submit Answer', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 16),
            Text('Auto-saving progress...', style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5), fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _ResultView extends ConsumerWidget {
  final int score;
  final int total;
  final String courseId;
  final String currentLessonId;

  const _ResultView({
    required this.score,
    required this.total,
    required this.courseId,
    required this.currentLessonId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    double percentage = (score / total) * 100;
    bool passed = percentage >= 70;

    final lessonsAsync = ref.watch(lessonsByCourseProvider(courseId));

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: lessonsAsync.when(
        data: (lessons) {
          final currentLessonIndex = lessons.indexWhere((l) => l.id == currentLessonId);
          final nextLesson = (currentLessonIndex != -1 && currentLessonIndex < lessons.length - 1)
              ? lessons[currentLessonIndex + 1]
              : null;

          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: passed ? Theme.of(context).colorScheme.secondary.withOpacity(0.1) : Theme.of(context).colorScheme.error.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      passed ? Symbols.workspace_premium : Symbols.error,
                      size: 64,
                      color: passed ? Theme.of(context).colorScheme.secondary : Theme.of(context).colorScheme.error,
                      fill: 1,
                    ),
                  ),
                  const SizedBox(height: 32),
                  Text(
                    passed ? 'Congratulations!' : 'Great Effort!',
                    style: GoogleFonts.manrope(fontSize: 32, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    passed ? 'You passed the module test.' : 'You didn\'t reach the 70% threshold.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6), fontSize: 16),
                  ),
                  const SizedBox(height: 48),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Column(
                      children: [
                        Text('YOUR SCORE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4), letterSpacing: 1.2)),
                        const SizedBox(height: 8),
                        Text('${percentage.toInt()}%', style: GoogleFonts.manrope(fontSize: 48, fontWeight: FontWeight.w800, color: passed ? Theme.of(context).colorScheme.secondary : Theme.of(context).colorScheme.error)),
                        Text('$score out of $total correct', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 48),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        if (passed) {
                          if (nextLesson != null) {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => LessonPlayerScreen(lesson: nextLesson)),
                            );
                          } else {
                            // Course completed via quiz!
                            final user = ref.read(currentUserProvider).value;
                            if (user != null) {
                              ref.read(authRepositoryProvider).completeCourse(user.id, courseId);
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(builder: (_) => CourseCompletionPage(courseId: courseId)),
                              );
                            }
                          }
                        } else {
                          Navigator.pop(context);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: passed ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.secondary,
                        foregroundColor: passed ? Theme.of(context).colorScheme.onPrimary : Theme.of(context).colorScheme.onSecondary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                      ),
                      child: Text(
                        passed 
                          ? (nextLesson != null ? 'Next Lesson' : 'Back to Course')
                          : 'Retake Quiz', 
                        style: const TextStyle(fontWeight: FontWeight.bold)
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, __) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
