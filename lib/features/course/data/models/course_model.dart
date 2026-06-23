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
      totalLessons: map['totalLessons'] is int 
          ? map['totalLessons'] 
          : int.tryParse(map['totalLessons']?.toString() ?? '0') ?? 0,
      rating: double.tryParse(map['rating']?.toString() ?? '0.0') ?? 0.0,
      isFeatured: map['isFeatured'] == true || map['isFeatured'] == 1 || map['isFeatured'] == '1',
      duration: map['duration'] ?? 'Self-paced',
      hasQuizzes: map['hasQuizzes'] == null || map['hasQuizzes'] == true || map['hasQuizzes'] == 1 || map['hasQuizzes'] == '1',
    );
  }
}
