import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../../../core/theme/app_theme.dart';

class CertificateScreen extends StatelessWidget {
  final String userName;
  final String courseName;
  final String date;
  final String certificateId;

  const CertificateScreen({
    super.key,
    required this.userName,
    required this.courseName,
    required this.date,
    required this.certificateId,
  });

  Future<void> _generatePdf() async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        build: (pw.Context context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(40),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.indigo900, width: 2),
            ),
            child: pw.Column(
              mainAxisAlignment: pw.MainAxisAlignment.center,
              children: [
                pw.Text('Certificate of Completion', style: pw.TextStyle(fontSize: 40, fontWeight: pw.FontWeight.bold, color: PdfColors.indigo900)),
                pw.SizedBox(height: 20),
                pw.Text('This is to certify that', style: const pw.TextStyle(fontSize: 18)),
                pw.SizedBox(height: 10),
                pw.Text(userName, style: pw.TextStyle(fontSize: 50, fontWeight: pw.FontWeight.bold, color: PdfColors.indigo900)),
                pw.SizedBox(height: 10),
                pw.Text('has successfully completed the course', style: const pw.TextStyle(fontSize: 18)),
                pw.SizedBox(height: 10),
                pw.Text(courseName, style: pw.TextStyle(fontSize: 30, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 40),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(children: [pw.Text('Date Awarded'), pw.Text(date)]),
                    pw.Column(children: [pw.Text('Certificate ID'), pw.Text(certificateId)]),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(onLayout: (PdfPageFormat format) async => pdf.save());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: Stack(
        children: [
          // Background Celebration
          Positioned.fill(child: CustomPaint(painter: _ConfettiPainter(Theme.of(context).colorScheme))),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('LCM College', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary, fontSize: 20)),
                      IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Symbols.close, color: Theme.of(context).colorScheme.onSurface)),
                    ],
                  ),
                  const SizedBox(height: 48),
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(color: Theme.of(context).colorScheme.secondary.withOpacity(0.1), shape: BoxShape.circle),
                    child: Icon(Symbols.workspace_premium, color: Theme.of(context).colorScheme.secondary, size: 48, fill: 1),
                  ),
                  const SizedBox(height: 24),
                  Text('Congratulations!', style: GoogleFonts.manrope(fontSize: 32, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
                  const SizedBox(height: 8),
                  Text('Your hard work and dedication have earned you this recognition.', textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                  const SizedBox(height: 48),
                  // Certificate Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.brightness == Brightness.light ? Colors.white : Theme.of(context).colorScheme.surfaceContainerHigh, 
                      borderRadius: BorderRadius.circular(32), 
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 24)],
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant, width: 2),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Column(
                        children: [
                          Text('OFFICIAL ACHIEVEMENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4))),
                          const SizedBox(height: 16),
                          Text('Certificate of Completion', style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary), textAlign: TextAlign.center),
                          const SizedBox(height: 8),
                          Container(width: 48, height: 4, decoration: BoxDecoration(color: Theme.of(context).colorScheme.secondary, borderRadius: const BorderRadius.all(Radius.circular(2)))),
                          const SizedBox(height: 32),
                          const Text('This is to certify that', style: TextStyle(fontSize: 16)),
                          const SizedBox(height: 8),
                          Text(userName, style: GoogleFonts.manrope(fontSize: 36, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.onSurface), textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          const Text('has successfully completed the professional course', style: TextStyle(fontSize: 16), textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
                            child: Text(courseName, style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary), textAlign: TextAlign.center),
                          ),
                          const SizedBox(height: 32),
                          const Divider(),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('DATE AWARDED', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4))),
                                  Text(date, style: const TextStyle(fontWeight: FontWeight.bold)),
                                ],
                              ),
                              CircleAvatar(
                                backgroundColor: Theme.of(context).colorScheme.secondary,
                                child: Icon(Symbols.verified, color: Theme.of(context).colorScheme.onSecondary, fill: 1),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('CERTIFICATE ID', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4))),
                                  Text(certificateId, style: const TextStyle(fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 48),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _generatePdf,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Theme.of(context).colorScheme.primary,
                            foregroundColor: Theme.of(context).colorScheme.onPrimary,
                          ),
                          icon: const Icon(Symbols.download),
                          label: const Text('Download PDF'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {},
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)), 
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
                          ),
                          icon: const Icon(Symbols.share),
                          label: const Text('Share'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  TextButton.icon(
                    onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
                    icon: const Icon(Symbols.arrow_back, size: 16),
                    label: const Text('Back to Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  final ColorScheme colorScheme;
  _ConfettiPainter(this.colorScheme);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    final random = math.Random(42);
    final colors = [
      colorScheme.secondary, 
      colorScheme.primary, 
      Colors.amber, 
      Colors.pink,
    ];
    for (var i = 0; i < 50; i++) {
      paint.color = colors[random.nextInt(colors.length)].withOpacity(0.1);
      canvas.drawCircle(
        Offset(random.nextDouble() * size.width, random.nextDouble() * size.height),
        (random.nextDouble() * 5 + 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
