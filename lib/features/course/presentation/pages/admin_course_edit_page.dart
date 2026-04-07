import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../data/models/course_model.dart';
import '../../data/repositories/course_repository.dart';
import '../providers/course_providers.dart';

class AdminCourseEditPage extends ConsumerStatefulWidget {
  final CourseModel course;
  const AdminCourseEditPage({super.key, required this.course});

  @override
  ConsumerState<AdminCourseEditPage> createState() => _AdminCourseEditPageState();
}

class _AdminCourseEditPageState extends ConsumerState<AdminCourseEditPage> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _titleController;
  late TextEditingController _descriptionController;
  late TextEditingController _categoryController;
  late TextEditingController _durationController;
  bool _isFeatured = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.course.title);
    _descriptionController = TextEditingController(text: widget.course.description);
    _categoryController = TextEditingController(text: widget.course.category);
    _durationController = TextEditingController(text: widget.course.duration);
    _isFeatured = widget.course.isFeatured;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _categoryController.dispose();
    _durationController.dispose();
    super.dispose();
  }

  Future<void> _handleUpdate() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final updatedCourse = CourseModel(
        id: widget.course.id,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        thumbnailUrl: widget.course.thumbnailUrl,
        category: _categoryController.text.trim(),
        totalLessons: widget.course.totalLessons,
        rating: widget.course.rating,
        isFeatured: _isFeatured,
        duration: _durationController.text.trim(),
        hasQuizzes: widget.course.hasQuizzes,
      );

      await ref.read(courseRepositoryProvider).updateCourse(updatedCourse);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Course updated successfully!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating course: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: Text('Edit Course', style: GoogleFonts.manrope(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildTextField(
                label: 'Course Title',
                controller: _titleController,
                icon: Symbols.title,
                validator: (v) => v?.isEmpty ?? true ? 'Title is required' : null,
              ),
              const SizedBox(height: 24),
              _buildTextField(
                label: 'Category',
                controller: _categoryController,
                icon: Symbols.category,
                validator: (v) => v?.isEmpty ?? true ? 'Category is required' : null,
              ),
              const SizedBox(height: 24),
              _buildTextField(
                label: 'Duration',
                controller: _durationController,
                icon: Symbols.schedule,
                hint: 'e.g. 12 Hours, 3 Weeks',
                validator: (v) => v?.isEmpty ?? true ? 'Duration is required' : null,
              ),
              const SizedBox(height: 24),
              _buildTextField(
                label: 'Description',
                controller: _descriptionController,
                icon: Symbols.description,
                maxLines: 8,
                validator: (v) => v?.isEmpty ?? true ? 'Description is required' : null,
              ),
              const SizedBox(height: 24),
              SwitchListTile(
                title: const Text('Featured Course', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Display this course in the featured section'),
                value: _isFeatured,
                onChanged: (v) => setState(() => _isFeatured = v),
                activeColor: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleUpdate,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Theme.of(context).colorScheme.onPrimary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Update Course', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    int maxLines = 1,
    String? hint,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4)),
            filled: true,
            fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }
}
