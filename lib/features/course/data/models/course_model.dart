class CourseModel {
  final String id;
  final String title;
  final String description;
  final String thumbnailUrl;
  final String category;
  final int totalLessons;
  final double rating;
  final bool isFeatured;
  final String duration;
  final bool hasQuizzes;

  CourseModel({
    required this.id,
    required this.title,
    required this.description,
    required this.thumbnailUrl,
    required this.category,
    required this.totalLessons,
    required this.rating,
    required this.isFeatured,
    required this.duration,
    required this.hasQuizzes,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'thumbnailUrl': thumbnailUrl,
      'category': category,
      'totalLessons': totalLessons,
      'rating': rating,
      'isFeatured': isFeatured,
      'duration': duration,
      'hasQuizzes': hasQuizzes,
    };
  }

  factory CourseModel.fromMap(Map<String, dynamic> map, String id) {
    return CourseModel(
      id: id,
      title: map['title'] ?? '',
      description: map['description'] ?? '',
      thumbnailUrl: map['thumbnailUrl'] ?? '',
      category: map['category'] ?? '',
      totalLessons: map['totalLessons'] ?? 0,
      rating: (map['rating'] ?? 0.0).toDouble(),
      isFeatured: map['isFeatured'] ?? false,
      duration: map['duration'] ?? 'Self-paced',
      hasQuizzes: map['hasQuizzes'] ?? true,
    );
  }
}
