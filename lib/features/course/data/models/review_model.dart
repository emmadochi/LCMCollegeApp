class ReviewModel {
  final String id;
  final String courseId;
  final String courseName;
  final String userId;
  final String userName;
  final String userEmail;
  final double rating;
  final String comment;
  final DateTime createdAt;

  ReviewModel({
    required this.id,
    required this.courseId,
    required this.courseName,
    required this.userId,
    required this.userName,
    required this.userEmail,
    required this.rating,
    required this.comment,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'courseId': courseId,
      'courseName': courseName,
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'rating': rating,
      'comment': comment,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory ReviewModel.fromMap(Map<String, dynamic> map, String id) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }
    return ReviewModel(
      id: id,
      courseId: map['courseId'] ?? map['course_id'] ?? '',
      courseName: map['courseName'] ?? map['course_name'] ?? '',
      userId: map['userId'] ?? map['user_id'] ?? '',
      userName: map['userName'] ?? map['user_name'] ?? 'Anonymous',
      userEmail: map['userEmail'] ?? map['user_email'] ?? '',
      rating: double.tryParse(map['rating']?.toString() ?? '0.0') ?? 0.0,
      comment: map['comment'] ?? '',
      createdAt: parseDate(map['createdAt'] ?? map['created_at']),
    );
  }
}
