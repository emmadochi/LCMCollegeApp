import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../quiz/presentation/pages/quiz_screen.dart';

import '../../data/models/lesson_model.dart';
import '../../data/models/assignment_model.dart';
import '../providers/assignment_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../course/presentation/providers/course_providers.dart';
import '../providers/learning_providers.dart';
import '../../data/models/progress_model.dart';
import '../../data/repositories/learning_repository.dart';
import '../../../quiz/presentation/providers/quiz_providers.dart';

class LessonPlayerScreen extends ConsumerWidget {
  final LessonModel lesson;
  const LessonPlayerScreen({super.key, required this.lesson});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quizAsync = ref.watch(quizByLessonProvider(lesson.id));
    final hasActuallyQuiz = quizAsync.when(
      data: (quiz) => quiz != null,
      loading: () => lesson.hasQuiz, // Fallback to model during loading
      error: (_, __) => lesson.hasQuiz,
    );

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('LCM College', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary)),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Video Player Area
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                color: Colors.black,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Image.network('https://lh3.googleusercontent.com/aida-public/AB6AXuD2Pjy9tB0CZQc4haxUX1wBViVl1nvH5hNGCpUlPVpgyzUGCs7wJaP63oOCBvUCxdG2kBU_j5fdhha5ayVKv5gvvLMtZFazUImk7Ou-Z51djo2JaoEk68OFvMYCX8IKsvvHTRFw-E0tyO_C7BLmi_rbLdd_giIKX89aZWkYiqAitnJY5KxTDJJdZ6s6EKY3NoCyypSzLkN--2jnpS0KAnn4a4OmAK5V_HSmAUsm_QgOXICBJ0iLmgHbHu3tC5XrXfbWW48mMNrWsOA', fit: BoxFit.cover, opacity: const AlwaysStoppedAnimation(0.6)),
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                      child: const Icon(Symbols.play_arrow, color: Colors.white, size: 32, fill: 1),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Symbols.school, size: 16, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 8),
                      ref.watch(courseByIdProvider(lesson.courseId)).when(
                        data: (course) => Text(
                          course.title.toUpperCase(), 
                          style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary, letterSpacing: 1.2)
                        ),
                        loading: () => Container(width: 100, height: 10, color: Theme.of(context).colorScheme.surfaceContainerHighest),
                        error: (_, __) => Text('UNNAMED COURSE', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary, letterSpacing: 1.2)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(lesson.title, style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.onSurface)),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      ref.watch(lessonsByCourseProvider(lesson.courseId)).when(
                        data: (lessons) {
                          final currentIndex = lessons.indexWhere((l) => l.id == lesson.id);
                          final prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
                          final nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

                          return Expanded(
                            child: Row(
                              children: [
                                _NavButton(
                                  icon: Symbols.chevron_left, 
                                  label: 'Previous', 
                                  onPressed: prevLesson == null ? null : () => Navigator.pushReplacement(
                                    context,
                                    MaterialPageRoute(builder: (_) => LessonPlayerScreen(lesson: prevLesson)),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                _NavButton(
                                  icon: nextLesson == null ? Symbols.check_circle : Symbols.chevron_right, 
                                  label: nextLesson == null ? 'Finish' : 'Next', 
                                  onPressed: nextLesson == null ? () => Navigator.pop(context) : () => Navigator.pushReplacement(
                                    context,
                                    MaterialPageRoute(builder: (_) => LessonPlayerScreen(lesson: nextLesson)),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                        loading: () => const Expanded(child: Center(child: LinearProgressIndicator())),
                        error: (_, __) => const Expanded(child: SizedBox()),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  // Tabs
                  DefaultTabController(
                    length: 4,
                    child: Column(
                      children: [
                        TabBar(
                          isScrollable: true,
                          indicatorColor: Theme.of(context).colorScheme.primary,
                          labelColor: Theme.of(context).colorScheme.primary,
                          unselectedLabelColor: Theme.of(context).colorScheme.onSurface.withOpacity(0.4),
                          tabs: const [
                            Tab(text: 'Notes'),
                            Tab(text: 'Assignment'),
                            Tab(text: 'Resources'),
                            Tab(text: 'Transcript'),
                          ],
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          height: 500,
                          child: TabBarView(
                            children: [
                              _NotesTab(notes: lesson.notes),
                              _AssignmentTab(lessonId: lesson.id),
                              const Center(child: Text('Resources')),
                              const Center(child: Text('Transcript')),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Container(
        width: MediaQuery.of(context).size.width - 48,
        height: 56,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Theme.of(context).colorScheme.secondary, 
              Theme.of(context).colorScheme.secondaryContainer,
            ],
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.secondary.withOpacity(0.3), 
              blurRadius: 12, 
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: ElevatedButton.icon(
          onPressed: () async {
            if (hasActuallyQuiz) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => QuizScreen(
                    courseId: lesson.courseId,
                    lessonId: lesson.id,
                  ),
                ),
              );
            } else {
              // Direct completion for lessons without quizzes
              try {
                final user = ref.read(currentUserProvider).value;
                if (user != null) {
                  final progress = ProgressModel(
                    userId: user.id,
                    courseId: lesson.courseId,
                    lessonId: lesson.id,
                    isCompleted: true,
                  );
                  await LearningRepository().updateProgress(progress);
                  
                  if (context.mounted) {
                    final lessons = ref.read(lessonsByCourseProvider(lesson.courseId)).value ?? [];
                    final currentIndex = lessons.indexWhere((l) => l.id == lesson.id);
                    if (currentIndex != -1 && currentIndex < lessons.length - 1) {
                      final nextLesson = lessons[currentIndex + 1];
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => LessonPlayerScreen(lesson: nextLesson)),
                      );
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lesson completed! Moving to next.')));
                    } else {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Course completed!')));
                    }
                  }
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                }
              }
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent, 
            shadowColor: Colors.transparent,
            foregroundColor: Theme.of(context).colorScheme.onSecondary,
          ),
          icon: Icon(hasActuallyQuiz ? Symbols.check_circle : Symbols.done_all, fill: 1),
          label: Text(hasActuallyQuiz ? 'Mark as Complete & Start Quiz' : 'Mark as Complete'),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  const _NavButton({required this.icon, required this.label, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 12),
          side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          disabledForegroundColor: Theme.of(context).colorScheme.onSurface.withOpacity(0.2),
        ),
        icon: Icon(icon, size: 18),
        label: Text(
          label, 
          style: TextStyle(
            fontSize: 14, 
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
      ),
    );
  }
}

class _AssignmentTab extends ConsumerStatefulWidget {
  final String lessonId;
  const _AssignmentTab({required this.lessonId});

  @override
  ConsumerState<_AssignmentTab> createState() => _AssignmentTabState();
}

class _AssignmentTabState extends ConsumerState<_AssignmentTab> {
  final _textController = TextEditingController();
  PlatformFile? _selectedFile;
  bool _isSubmitting = false;

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    if (result != null) {
      setState(() => _selectedFile = result.files.first);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignmentAsync = ref.watch(lessonAssignmentProvider(widget.lessonId));

    return assignmentAsync.when(
      data: (assignment) {
        if (assignment == null) {
          return const Center(child: Text('No assignment for this lesson.'));
        }

        final submissionAsync = ref.watch(userSubmissionProvider(assignment.id));

        return submissionAsync.when(
          data: (submission) {
            if (submission != null) {
              return _SubmissionStatusView(submission: submission);
            }

            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(assignment.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  const SizedBox(height: 8),
                  Text('Due: ${assignment.dueDate.day}/${assignment.dueDate.month}/${assignment.dueDate.year}', style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Text(assignment.instructions, style: TextStyle(color: Colors.grey.shade700)),
                  const SizedBox(height: 32),
                  const Text('Your Submission', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _textController,
                    maxLines: 5,
                    decoration: InputDecoration(
                      hintText: 'Write your response here...',
                      filled: true,
                      fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12), 
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  InkWell(
                    onTap: _pickFile,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Theme.of(context).colorScheme.primary.withOpacity(0.2), style: BorderStyle.solid),
                      ),
                      child: Row(
                        children: [
                          Icon(Symbols.upload_file, color: Theme.of(context).colorScheme.primary),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _selectedFile?.name ?? 'Upload a document (PDF, DOCX...)',
                              style: TextStyle(color: _selectedFile != null ? Theme.of(context).colorScheme.onSurface : Theme.of(context).colorScheme.primary, fontSize: 13),
                            ),
                          ),
                          if (_selectedFile != null) IconButton(onPressed: () => setState(() => _selectedFile = null), icon: const Icon(Symbols.close, size: 18)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : () => _submit(assignment),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        foregroundColor: Theme.of(context).colorScheme.onPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSubmitting 
                        ? SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Theme.of(context).colorScheme.onPrimary, strokeWidth: 2))
                        : const Text('Submit Assignment', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, __) => Text('Error: $e'),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, __) => Text('Error: $e'),
    );
  }

  Future<void> _submit(AssignmentModel assignment) async {
    if (_textController.text.isEmpty && _selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please provide some content or upload a file.')));
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final user = ref.read(currentUserProvider).value!;
      final submission = SubmissionModel(
        id: '',
        assignmentId: assignment.id,
        lessonId: assignment.lessonId,
        userId: user.id,
        userName: user.fullName,
        userEmail: user.email,
        submissionType: _selectedFile != null ? 'file' : 'text',
        text: _textController.text,
        fileName: _selectedFile?.name ?? '',
        submittedAt: DateTime.now(),
      );

      await ref.read(assignmentRepositoryProvider).submitAssignment(
        submission: submission,
        file: _selectedFile != null ? File(_selectedFile!.path!) : null,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Assignment submitted!')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}

class _SubmissionStatusView extends StatelessWidget {
  final SubmissionModel submission;
  const _SubmissionStatusView({required this.submission});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh, 
        borderRadius: BorderRadius.circular(20), 
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                submission.status == 'graded' ? Symbols.check_circle : Symbols.schedule,
                color: submission.status == 'graded' ? Colors.green : Colors.orange,
              ),
              const SizedBox(width: 12),
              Text(
                submission.status == 'graded' ? 'Graded' : 'Submitted & Pending Review',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: submission.status == 'graded' ? Colors.green : Colors.orange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          if (submission.status == 'graded') ...[
            Text('Grade: ${submission.grade}', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary)),
            const SizedBox(height: 8),
            Text('Feedback: ${submission.feedback}', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7))),
            const SizedBox(height: 24),
          ],
          Text('Your Response:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4))),
          const SizedBox(height: 8),
          if (submission.submissionType == 'text')
            Text(submission.text)
          else
            Row(
              children: [
                const Icon(Symbols.description, size: 16),
                const SizedBox(width: 8),
                Text(submission.fileName, style: const TextStyle(fontSize: 13, decoration: TextDecoration.underline)),
              ],
            ),
          const SizedBox(height: 16),
          Text('Submitted on: ${submission.submittedAt.day}/${submission.submittedAt.month}/${submission.submittedAt.year}', style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3))),
        ],
      ),
    );
  }
}

class _BulletPoint extends StatelessWidget {
  final String text;
  const _BulletPoint({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(margin: const EdgeInsets.only(top: 6), width: 6, height: 6, decoration: BoxDecoration(color: Theme.of(context).colorScheme.secondary, shape: BoxShape.circle)),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7), height: 1.5))),
        ],
      ),
    );
  }
}

class _NotesTab extends StatelessWidget {
  final String? notes;
  const _NotesTab({this.notes});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Lesson Notes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          SizedBox(height: 16),
          Text(
            notes == null || notes!.isEmpty 
                ? 'No specific notes for this lesson.' 
                : notes!,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7), height: 1.5),
          ),
        ],
      ),
    );
  }
}
