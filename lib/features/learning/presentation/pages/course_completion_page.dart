import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../course/data/models/course_model.dart';
import '../../../course/presentation/providers/course_providers.dart';
import '../providers/learning_providers.dart';

class CourseCompletionPage extends ConsumerStatefulWidget {
  final String courseId;

  const CourseCompletionPage({super.key, required this.courseId});

  @override
  ConsumerState<CourseCompletionPage> createState() => _CourseCompletionPageState();
}

class _CourseCompletionPageState extends ConsumerState<CourseCompletionPage> {
  bool _isRequesting = false;
  bool _requested = false;

  Future<void> _handleCertificateRequest() async {
    setState(() => _isRequesting = true);
    try {
      final user = ref.read(currentUserProvider).value;
      if (user != null) {
        await ref.read(learningRepositoryProvider).requestCertificate(user.id, widget.courseId);
        setState(() => _requested = true);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Certificate request sent successfully!')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error requesting certificate: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isRequesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final courseAsync = ref.watch(courseByIdProvider(widget.courseId));

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: courseAsync.when(
        data: (course) => SafeArea(
          child: Stack(
            children: [
              // Celebration Background Element (Subtle)
              Positioned(
                top: -100,
                right: -100,
                child: Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withOpacity(0.05),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 40.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 40),
                    // Celebration Image
                    Container(
                      width: double.infinity,
                      height: 280,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(32),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(32),
                        child: Image.asset(
                          'assets/images/course_completed.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(height: 48),
                    // Congrats Text
                    Text(
                      'CONGRATULATIONS!',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 4,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Course Completed',
                      style: GoogleFonts.manrope(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: Text(
                        'You have successfully navigated through all the modules of "${course.title}". Your dedication to learning is truly commendable.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                          height: 1.6,
                        ),
                      ),
                    ),
                    const SizedBox(height: 48),
                    // Action Buttons
                    Container(
                      width: double.infinity,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: _requested
                              ? [Colors.green.shade600, Colors.green.shade400]
                              : [
                                  Theme.of(context).colorScheme.primary,
                                  Theme.of(context).colorScheme.primaryContainer,
                                ],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: (_requested ? Colors.green : Theme.of(context).colorScheme.primary).withOpacity(0.3),
                            blurRadius: 15,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        ),
                        onPressed: (_isRequesting || _requested) ? null : _handleCertificateRequest,
                        child: _isRequesting
                            ? const CircularProgressIndicator(color: Colors.white)
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(_requested ? Symbols.check_circle : Symbols.workspace_premium, fill: 1, color: Colors.white),
                                  const SizedBox(width: 12),
                                  Text(
                                    _requested ? 'Certificate Requested' : 'Claim Your Certificate',
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 64,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
                        ),
                        onPressed: () {
                          Navigator.of(context).popUntil((route) => route.isFirst);
                        },
                        child: Text(
                          'Back to Dashboard',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, __) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
