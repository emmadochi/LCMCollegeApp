import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../course/presentation/pages/course_discovery_page.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import '../../../learning/presentation/pages/my_courses_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  int _selectedIndex = 0;

  final List<Widget> _pages = [
    const CourseDiscoveryPage(),
    const MyCoursesPage(),
    const Center(child: Text('Search')),
    const ProfilePage(),
    const Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Symbols.admin_panel_settings, size: 64, color: Colors.blue),
        SizedBox(height: 16),
        Text('Admin Dashboard', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        Padding(
          padding: EdgeInsets.all(24.0),
          child: Text('Use the "Edit Course" buttons on course detail pages to manage curriculum.', textAlign: TextAlign.center),
        ),
      ],
    )),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_selectedIndex],
      bottomNavigationBar: Container(
        padding: const EdgeInsets.only(bottom: 24, top: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withOpacity(0.8),
          borderRadius: const BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, -8)),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(
              icon: Symbols.home,
              label: 'Home',
              isActive: _selectedIndex == 0,
              onTap: () => setState(() => _selectedIndex = 0),
            ),
            _NavItem(
              icon: Symbols.import_contacts,
              label: 'My Courses',
              isActive: _selectedIndex == 1,
              onTap: () => setState(() => _selectedIndex = 1),
            ),
            _NavItem(
              icon: Symbols.search,
              label: 'Search',
              isActive: _selectedIndex == 2,
              onTap: () => setState(() => _selectedIndex = 2),
            ),
            _NavItem(
              icon: Symbols.person,
              label: 'Profile',
              isActive: _selectedIndex == 3,
              onTap: () => setState(() => _selectedIndex = 3),
            ),
            if (ref.watch(currentUserProvider).value?.isAdmin ?? false)
              _NavItem(
                icon: Symbols.admin_panel_settings,
                label: 'Admin',
                isActive: _selectedIndex == 4,
                onTap: () => setState(() => _selectedIndex = 4),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({required this.icon, required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: isActive
            ? BoxDecoration(
                color: Theme.of(context).colorScheme.secondary,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: Theme.of(context).colorScheme.secondary.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4)),
                ],
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: isActive ? Theme.of(context).colorScheme.onSecondary : Theme.of(context).colorScheme.onSurface.withOpacity(0.4), size: 24),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isActive ? Theme.of(context).colorScheme.onSecondary : Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
