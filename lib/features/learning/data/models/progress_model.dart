class ProgressModel {
  final String userId;
  final String courseId;
  final String lessonId;
  final bool isCompleted;
  final int lastQuizScore; // Score in percentage
  final int attempts;

  ProgressModel({
    required this.userId,
    required this.courseId,
    required this.lessonId,
    this.isCompleted = false,
    this.lastQuizScore = 0,
    this.attempts = 0,
  });

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'courseId': courseId,
      'lessonId': lessonId,
      'isCompleted': isCompleted,
      'lastQuizScore': lastQuizScore,
      'attempts': attempts,
    };
  }

  factory ProgressModel.fromMap(Map<String, dynamic> map) {
    return ProgressModel(
      userId: map['userId'] ?? '',
      courseId: map['courseId'] ?? '',
      lessonId: map['lessonId'] ?? '',
      isCompleted: map['isCompleted'] ?? false,
      lastQuizScore: map['lastQuizScore'] ?? 0,
      attempts: map['attempts'] ?? 0,
    );
  }
}
