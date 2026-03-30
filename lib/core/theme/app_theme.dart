import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF000666);
  static const Color secondaryColor = Color(0xFF006B5C);
  static const Color surfaceColor = Color(0xFFF7F9FC);
  static const Color onSurfaceColor = Color(0xFF191C1E);
  static const Color errorColor = Color(0xFFBA1A1A);
  static const Color primaryContainer = Color(0xFF1A237E);
  static const Color onPrimary = Colors.white;

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: primaryColor,
        secondary: secondaryColor,
        surface: surfaceColor,
        error: errorColor,
        onPrimary: onPrimary,
        onSurface: onSurfaceColor,
      ),
      scaffoldBackgroundColor: surfaceColor,
      textTheme: GoogleFonts.manropeTextTheme().copyWith(
        displayLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.w800,
          color: onSurfaceColor,
        ),
        titleLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.bold,
          color: onSurfaceColor,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: onPrimary,
          textStyle: GoogleFonts.manrope(
            fontWeight: FontWeight.bold,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(9999),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        brightness: Brightness.dark,
        primary: const Color(0xFF9FA8DA), // Lighter indigo for dark mode
        secondary: const Color(0xFF80CBC4), // Lighter teal for dark mode
        surface: const Color(0xFF1A1C1E),
        onSurface: const Color(0xFFE1E2E4),
        error: const Color(0xFFFFB4AB),
        onPrimary: const Color(0xFF000666),
      ),
      scaffoldBackgroundColor: const Color(0xFF1A1C1E),
      textTheme: GoogleFonts.manropeTextTheme().copyWith(
        displayLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.w800,
          color: const Color(0xFFE1E2E4),
        ),
        titleLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.bold,
          color: const Color(0xFFE1E2E4),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF9FA8DA),
          foregroundColor: const Color(0xFF000666),
          textStyle: GoogleFonts.manrope(
            fontWeight: FontWeight.bold,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(9999),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }
}
