import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/theme/app_theme.dart';
import 'core/providers/shared_prefs_provider.dart';
import 'core/services/notification_service.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/auth/presentation/providers/auth_providers.dart';
import 'features/dashboard/presentation/pages/dashboard_page.dart'; // To be implemented
import 'features/onboarding/presentation/pages/onboarding_page.dart';
import 'features/onboarding/presentation/providers/onboarding_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Ensure Firebase is initialized (User needs to add google-services.json)
  try {
    await Firebase.initializeApp();
    await NotificationService().initialize();
  } catch (e) {
    debugPrint('Firebase initialization failed: $e');
  }

  final sharedPrefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(sharedPrefs),
      ],
      child: const LCMCollege(),
    ),
  );
}

class LCMCollege extends ConsumerWidget {
  const LCMCollege({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasSeenOnboarding = ref.watch(hasSeenOnboardingProvider);
    final authState = ref.watch(authStateProvider);

    return MaterialApp(
      title: 'LCM College',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: hasSeenOnboarding
          ? authState.when(
              data: (user) {
                if (user != null) {
                  return const DashboardPage();
                }
                return const LoginPage();
              },
              loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
              error: (e, st) => Scaffold(body: Center(child: Text('Error: $e'))),
            )
          : const OnboardingPage(),
      debugShowCheckedModeBanner: false,
    );
  }
}
