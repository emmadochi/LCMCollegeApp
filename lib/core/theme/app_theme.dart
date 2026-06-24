import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF7DC026); // Brand Green
  static const Color secondaryColor = Color(0xFF2E7D32); // Forest Green
  static const Color surfaceColor = Color(0xFFF6FAF0); // Soft off-white green
  static const Color onSurfaceColor = Color(0xFF1A2D0E); // Dark Forest Green Text
  static const Color errorColor = Color(0xFFBA1A1A);
  static const Color primaryContainer = Color(0xFFD4E9B8); // Light green border/accent
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
        primaryContainer: primaryContainer,
      ),
      scaffoldBackgroundColor: surfaceColor,
      textTheme: GoogleFonts.manropeTextTheme().copyWith(
        displayLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.w800,
          color: onSurfaceColor,
          letterSpacing: -1.0,
        ),
        titleLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.w800,
          color: onSurfaceColor,
          letterSpacing: -0.5,
        ),
        headlineSmall: GoogleFonts.manrope(
          fontWeight: FontWeight.bold,
          color: onSurfaceColor,
        ),
        bodyMedium: GoogleFonts.manrope(
          color: onSurfaceColor.withOpacity(0.85),
          height: 1.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFFE4ECD8), width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: onPrimary,
          elevation: 2,
          shadowColor: primaryColor.withOpacity(0.3),
          textStyle: GoogleFonts.manrope(
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
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
        primary: const Color(0xFF98DF43), // Vibrant lime green for dark mode
        secondary: const Color(0xFF81C784), // Soft green accent
        surface: const Color(0xFF11140E), // Very dark green background
        onSurface: const Color(0xFFE2E4DC),
        error: const Color(0xFFFFB4AB),
        onPrimary: const Color(0xFF1A2D0E),
        primaryContainer: const Color(0xFF2E421E),
      ),
      scaffoldBackgroundColor: const Color(0xFF11140E),
      textTheme: GoogleFonts.manropeTextTheme().copyWith(
        displayLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.w800,
          color: const Color(0xFFE2E4DC),
          letterSpacing: -1.0,
        ),
        titleLarge: GoogleFonts.manrope(
          fontWeight: FontWeight.w800,
          color: const Color(0xFFE2E4DC),
          letterSpacing: -0.5,
        ),
        headlineSmall: GoogleFonts.manrope(
          fontWeight: FontWeight.bold,
          color: const Color(0xFFE2E4DC),
        ),
        bodyMedium: GoogleFonts.manrope(
          color: const Color(0xFFE2E4DC).withOpacity(0.85),
          height: 1.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFF1C2216),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF2D3823), width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF98DF43),
          foregroundColor: const Color(0xFF1A2D0E),
          textStyle: GoogleFonts.manrope(
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }
}
