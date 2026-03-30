import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AppShimmer extends StatefulWidget {
  final Widget child;
  final bool isEnabled;

  const AppShimmer({
    super.key,
    required this.child,
    this.isEnabled = true,
  });

  @override
  State<AppShimmer> createState() => _AppShimmerState();
}

class _AppShimmerState extends State<AppShimmer> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isEnabled) return widget.child;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.grey.shade300.withOpacity(0.3),
                Colors.grey.shade100.withOpacity(0.1),
                Colors.grey.shade300.withOpacity(0.3),
              ],
              stops: const [0.1, 0.5, 0.9],
              transform: _SlidingGradientTransform(offset: _controller.value),
            ).createShader(bounds);
          },
          child: widget.child,
        );
      },
    );
  }
}

class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform({required this.offset});

  final double offset;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * offset, 0.0, 0.0);
  }
}

class SkeletonBox extends StatelessWidget {
  final double? width;
  final double? height;
  final double borderRadius;

  const SkeletonBox({
    super.key,
    this.width,
    this.height,
    this.borderRadius = 8,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey.shade300,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

class CourseCardSkeleton extends StatelessWidget {
  final bool isVertical;

  const CourseCardSkeleton({super.key, this.isVertical = false});

  @override
  Widget build(BuildContext context) {
    return AppShimmer(
      child: isVertical ? _buildVertical() : _buildHorizontal(),
    );
  }

  Widget _buildVertical() {
    return Container(
      width: 280,
      margin: const EdgeInsets.only(right: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonBox(height: 160, width: double.infinity, borderRadius: 24),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBox(height: 10, width: 60),
                const SizedBox(height: 8),
                const SkeletonBox(height: 16, width: double.infinity),
                const SizedBox(height: 4),
                const SkeletonBox(height: 16, width: 150),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHorizontal() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const SkeletonBox(width: 90, height: 90, borderRadius: 16),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBox(height: 10, width: 50),
                const SizedBox(height: 8),
                const SkeletonBox(height: 14, width: double.infinity),
                const SizedBox(height: 12),
                Row(
                  children: const [
                    SkeletonBox(height: 12, width: 40),
                    Spacer(),
                    SkeletonBox(height: 16, width: 16, borderRadius: 99),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
