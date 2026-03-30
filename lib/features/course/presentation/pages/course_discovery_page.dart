import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/course_model.dart';
import '../../data/repositories/course_repository.dart';
import '../providers/course_providers.dart';
import '../../data/models/category_model.dart';
import 'course_detail_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

class CourseDiscoveryPage extends ConsumerWidget {
  const CourseDiscoveryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider).value;
    final searchQuery = ref.watch(searchQueryProvider);
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final isSearching = searchQuery.isNotEmpty || selectedCategory != null;

    final filteredCoursesAsync = ref.watch(filteredCoursesProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'LCM College',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: Icon(Symbols.notifications, color: Theme.of(context).colorScheme.primary),
          ),
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
          ref.invalidate(allCoursesProvider);
          ref.invalidate(categoriesProvider);
          // Wait for the providers to finish refreshing if needed, 
          // but invalidate is usually enough for UI to show loading.
          await ref.read(allCoursesProvider.future);
          await ref.read(categoriesProvider.future);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isSearching) ...[
                Text(
                  'Explore your next\nacademic frontier',
                  style: GoogleFonts.manrope(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.primary,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 24),
              ],
              // Search Bar
              TextField(
                onChanged: (value) => ref.read(searchQueryProvider.notifier).state = value,
                decoration: InputDecoration(
                  hintText: 'Search courses, mentors...',
                  prefixIcon: const Icon(Symbols.search),
                  suffixIcon: searchQuery.isNotEmpty 
                    ? IconButton(
                        icon: const Icon(Symbols.close),
                        onPressed: () => ref.read(searchQueryProvider.notifier).state = '',
                      )
                    : null,
                  filled: true,
                  fillColor: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHighest,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              // Categories
              const _CategoriesSection(),
              const SizedBox(height: 40),

              if (isSearching) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Search Results',
                      style: GoogleFonts.manrope(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        ref.read(searchQueryProvider.notifier).state = '';
                        ref.read(selectedCategoryProvider.notifier).state = null;
                      },
                      child: const Text('Clear all'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                filteredCoursesAsync.when(
                  data: (courses) {
                    if (courses.isEmpty) {
                      return const Center(child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 48),
                        child: Text("No courses match your criteria."),
                      ));
                    }
                    return Column(
                      children: courses.map((course) => _CourseListItem(
                        title: course.title,
                        rating: course.rating,
                        category: course.category,
                        imageUrl: course.thumbnailUrl.isNotEmpty ? course.thumbnailUrl : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070',
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => CourseDetailPage(courseId: course.id)),
                        ),
                      )).toList(),
                    );
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, __) => Text('Error: $e'),
                ),
              ] else ...[
                const _SectionHeader(title: 'Featured Curriculum', subtitle: "EDITOR'S CHOICE"),
                const SizedBox(height: 16),
                SizedBox(
                  height: 280,
                  child: StreamBuilder<List<CourseModel>>(
                    stream: CourseRepository().getFeaturedCourses(),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const Center(child: Text("No courses found"));
                      }
                      final courses = snapshot.data!;
                      return ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: courses.length,
                        separatorBuilder: (context, index) => const SizedBox(width: 16),
                        itemBuilder: (context, index) {
                          final course = courses[index];
                          return _FeaturedCard(
                            title: course.title,
                            rating: course.rating,
                            imageUrl: course.thumbnailUrl.isNotEmpty ? course.thumbnailUrl : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070',
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => CourseDetailPage(courseId: course.id),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 40),
                const _SectionHeader(title: 'Popular Academy Tracks'),
                const SizedBox(height: 16),
                StreamBuilder<List<CourseModel>>(
                  stream: CourseRepository().getCourses(),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) return const SizedBox();
                    final courses = snapshot.data!;
                    return Column(
                      children: courses.map((course) => _CourseListItem(
                        title: course.title,
                        rating: course.rating,
                        category: course.category,
                        imageUrl: course.thumbnailUrl.isNotEmpty ? course.thumbnailUrl : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070',
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => CourseDetailPage(courseId: course.id),
                          ),
                        ),
                      )).toList(),
                    );
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;

  const _SectionHeader({required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (subtitle != null)
              Text(
                subtitle!,
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.secondary,
                  letterSpacing: 1.2,
                ),
              ),
            Text(
              title,
              style: GoogleFonts.manrope(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ],
        ),
        TextButton(onPressed: () {}, child: const Text('View all')),
      ],
    );
  }
}

class _FeaturedCard extends StatelessWidget {
  final String title;
  final double rating;
  final String imageUrl;
  final VoidCallback onTap;

  const _FeaturedCard({
    required this.title,
    required this.rating,
    required this.imageUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 280,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              child: Image.network(imageUrl, height: 160, width: double.infinity, fit: BoxFit.cover),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold, 
                      fontSize: 16,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Spacer(),
                      const Icon(Symbols.star, color: Colors.amber, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        rating.toString(),
                        style: TextStyle(
                          fontWeight: FontWeight.bold, 
                          fontSize: 12,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CourseListItem extends StatelessWidget {
  final String title;
  final double rating;
  final String category;
  final String imageUrl;
  final VoidCallback onTap;

  const _CourseListItem({
    required this.title,
    required this.rating,
    required this.category,
    required this.imageUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(imageUrl, width: 80, height: 80, fit: BoxFit.cover),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                          maxLines: 1,
                        ),
                      ),
                      Text(
                        rating.toString(),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.secondary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.grey.shade100 : Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      category.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoriesSection extends ConsumerWidget {
  const _CategoriesSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final selectedCategory = ref.watch(selectedCategoryProvider);

    return categoriesAsync.when(
      data: (categories) {
        if (categories.isEmpty) return const SizedBox();
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: categories.map((cat) {
              final isSelected = selectedCategory == cat.name;
              return GestureDetector(
                onTap: () {
                  if (isSelected) {
                    ref.read(selectedCategoryProvider.notifier).state = null;
                  } else {
                    ref.read(selectedCategoryProvider.notifier).state = cat.name;
                  }
                },
                child: Padding(
                  padding: const EdgeInsets.only(right: 20),
                  child: Column(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: isSelected ? Theme.of(context).colorScheme.primary : (Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4)],
                        ),
                        child: Icon(
                          _getIconData(cat.icon), 
                          size: 28, 
                          color: isSelected ? Theme.of(context).colorScheme.onPrimary : Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        cat.name, 
                        style: TextStyle(
                          fontSize: 10, 
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const SizedBox(),
    );
  }

  IconData _getIconData(String name) {
    switch (name.toLowerCase()) {
      case 'terminal': return Symbols.terminal;
      case 'payments': return Symbols.payments;
      case 'architecture': return Symbols.architecture;
      case 'campaign': return Symbols.campaign;
      case 'school': return Symbols.school;
      case 'psychology': return Symbols.psychology;
      case 'database': return Symbols.database;
      case 'menu_book': return Symbols.menu_book;
      case 'palette': return Symbols.palette;
      case 'code': return Symbols.code;
      default: return Symbols.category;
    }
  }
}
