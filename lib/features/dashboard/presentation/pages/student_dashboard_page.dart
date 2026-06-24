import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

class StudentDashboardPage extends ConsumerStatefulWidget {
  const StudentDashboardPage({super.key});

  @override
  ConsumerState<StudentDashboardPage> createState() => _StudentDashboardPageState();
}

class _StudentDashboardPageState extends ConsumerState<StudentDashboardPage> with SingleTickerProviderStateMixin {
  late final AnimationController _entranceController;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(currentUserProvider);
    final theme = Theme.of(context);

    // Custom Color Palette matching mockup
    final darkForestGreen = theme.brightness == Brightness.light ? const Color(0xFF1A2D0E) : const Color(0xFFE2E4DC);
    const leafGreenStart = Color(0xFF7DC026);
    const leafGreenEnd = Color(0xFF2E7D32);
    final mintBg = theme.brightness == Brightness.light ? const Color(0xFFF6FAF0) : const Color(0xFF1C2216);
    final softBorder = theme.brightness == Brightness.light ? const Color(0xFFD4E9B8) : const Color(0xFF2D3823);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: userAsync.when(
        data: (user) {
          final fullName = user?.fullName.isNotEmpty == true ? user!.fullName : "Emmanuel Adeyemi";
          final profileUrl = user?.profileImageUrl;

          return SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Profile Header Gradient Card
                  FadeTransition(
                    opacity: CurvedAnimation(parent: _entranceController, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
                    child: SlideTransition(
                      position: Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
                        CurvedAnimation(parent: _entranceController, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
                      ),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [leafGreenStart, leafGreenEnd],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: leafGreenEnd.withOpacity(0.3),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        "GOOD MORNING",
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white.withOpacity(0.8),
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      const Icon(Symbols.nest_eco_leaf, color: Colors.white, size: 14),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    fullName,
                                    style: GoogleFonts.outfit(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    "Theology Major · Year 3",
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      color: Colors.white.withOpacity(0.9),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                                image: profileUrl != null && profileUrl.isNotEmpty
                                    ? DecorationImage(image: NetworkImage(profileUrl), fit: BoxFit.cover)
                                    : null,
                              ),
                              child: (profileUrl == null || profileUrl.isEmpty)
                                  ? const Icon(Symbols.person, color: Colors.white, size: 32)
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 2. Floating alert banners / Horizontal list (Engaging Carousel)
                  FadeTransition(
                    opacity: CurvedAnimation(parent: _entranceController, curve: const Interval(0.2, 0.7, curve: Curves.easeOut)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          height: 85,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            physics: const BouncingScrollPhysics(),
                            clipBehavior: Clip.none,
                            children: [
                              _FloatingAlertCard(
                                icon: Symbols.local_fire_department,
                                iconColor: const Color(0xFFFA5A2A),
                                iconBg: const Color(0xFFFFF2EE),
                                title: "Walk in Authority",
                                subtitle: "Empowered by Faith",
                                borderThemeColor: theme.brightness == Brightness.light ? const Color(0xFFF9EAE1) : const Color(0xFF382B24),
                                cardBg: theme.brightness == Brightness.light ? const Color(0xFFFDF8F5) : const Color(0xFF221A16),
                                onTap: () {},
                              ),
                              const SizedBox(width: 12),
                              _FloatingAlertCard(
                                icon: Symbols.distance,
                                iconColor: leafGreenEnd,
                                iconBg: mintBg,
                                title: "On-Site & Online",
                                subtitle: "Flexible hybrid learning",
                                borderThemeColor: softBorder,
                                cardBg: theme.brightness == Brightness.light ? const Color(0xFFF7FAF7) : const Color(0xFF151B12),
                                onTap: () {},
                              ),
                              const SizedBox(width: 12),
                              _FloatingAlertCard(
                                icon: Symbols.assignment,
                                iconColor: const Color(0xFF1E88E5),
                                iconBg: const Color(0xFFE3F2FD),
                                title: "New Assignment",
                                subtitle: "Due in 3 days",
                                borderThemeColor: theme.brightness == Brightness.light ? const Color(0xFFE1F5FE) : const Color(0xFF1A2B35),
                                cardBg: theme.brightness == Brightness.light ? const Color(0xFFF6FBFE) : const Color(0xFF111D24),
                                onTap: () {},
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 3. Active Courses Trackers
                  FadeTransition(
                    opacity: CurvedAnimation(parent: _entranceController, curve: const Interval(0.4, 0.9, curve: Curves.easeOut)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "ACTIVE COURSES",
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: theme.brightness == Brightness.light ? Colors.black54 : Colors.white60,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _CourseProgressCard(
                          title: "Biblical Hermeneutics",
                          icon: Symbols.book,
                          progress: 0.72,
                          progressText: "72% complete",
                          themeColor: leafGreenEnd,
                          mintBg: mintBg,
                          softBorder: softBorder,
                        ),
                        const SizedBox(height: 12),
                        _CourseProgressCard(
                          title: "Systematic Theology II",
                          icon: Symbols.church,
                          progress: 0.45,
                          progressText: "45% complete",
                          themeColor: leafGreenEnd,
                          mintBg: mintBg,
                          softBorder: softBorder,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // 4. Stats Metrics Grid
                  FadeTransition(
                    opacity: CurvedAnimation(parent: _entranceController, curve: const Interval(0.6, 1.0, curve: Curves.easeOut)),
                    child: Row(
                      children: [
                        Expanded(
                          child: _MetricCard(
                            value: "8",
                            label: "COURSES",
                            mintBg: mintBg,
                            softBorder: softBorder,
                            textColor: darkForestGreen,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _MetricCard(
                            value: "96%",
                            label: "AVG SCORE",
                            mintBg: mintBg,
                            softBorder: softBorder,
                            textColor: darkForestGreen,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: leafGreenEnd)),
        error: (err, stack) => Center(child: Text("Error: $err")),
      ),
    );
  }
}

class _FloatingAlertCard extends StatefulWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String subtitle;
  final Color borderThemeColor;
  final Color cardBg;
  final VoidCallback onTap;

  const _FloatingAlertCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.subtitle,
    required this.borderThemeColor,
    required this.cardBg,
    required this.onTap,
  });

  @override
  State<_FloatingAlertCard> createState() => _FloatingAlertCardState();
}

class _FloatingAlertCardState extends State<_FloatingAlertCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          width: 200,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: widget.borderThemeColor, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: widget.iconColor.withOpacity(0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: widget.iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(widget.icon, color: widget.iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.title,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.subtitle,
                      style: GoogleFonts.outfit(
                        fontSize: 10,
                        color: theme.colorScheme.onSurface.withOpacity(0.65),
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CourseProgressCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final double progress;
  final String progressText;
  final Color themeColor;
  final Color mintBg;
  final Color softBorder;

  const _CourseProgressCard({
    required this.title,
    required this.icon,
    required this.progress,
    required this.progressText,
    required this.themeColor,
    required this.mintBg,
    required this.softBorder,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: softBorder, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: mintBg.withOpacity(0.5),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: themeColor, size: 22),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                _AnimatedProgressBar(
                  progress: progress,
                  color: themeColor,
                ),
                const SizedBox(height: 4),
                Text(
                  progressText,
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: themeColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AnimatedProgressBar extends StatefulWidget {
  final double progress;
  final Color color;

  const _AnimatedProgressBar({required this.progress, required this.color});

  @override
  State<_AnimatedProgressBar> createState() => _AnimatedProgressBarState();
}

class _AnimatedProgressBarState extends State<_AnimatedProgressBar> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _animation = Tween<double>(begin: 0, end: widget.progress).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(covariant _AnimatedProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.progress != widget.progress) {
      _controller.reset();
      _animation = Tween<double>(begin: 0, end: widget.progress).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
      );
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: _animation.value,
            backgroundColor: widget.color.withOpacity(0.12),
            valueColor: AlwaysStoppedAnimation<Color>(widget.color),
            minHeight: 8,
          ),
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String value;
  final String label;
  final Color mintBg;
  final Color softBorder;
  final Color textColor;

  const _MetricCard({
    required this.value,
    required this.label,
    required this.mintBg,
    required this.softBorder,
    required this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: mintBg.withOpacity(0.3),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: softBorder, width: 1.5),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: textColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: textColor.withOpacity(0.6),
              letterSpacing: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}
