class AssignmentModel {
  final String id;
  final String lessonId;
  final String courseId;
  final String title;
  final String instructions;
  final DateTime dueDate;
  final DateTime createdAt;

  AssignmentModel({
    required this.id,
    required this.lessonId,
    required this.courseId,
    required this.title,
    required this.instructions,
    required this.dueDate,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'lessonId': lessonId,
      'courseId': courseId,
      'title': title,
      'instructions': instructions,
      'dueDate': dueDate.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory AssignmentModel.fromMap(Map<String, dynamic> map, String id) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }
    return AssignmentModel(
      id: id,
      lessonId: map['lessonId'] ?? map['lesson_id'] ?? '',
      courseId: map['courseId'] ?? map['course_id'] ?? '',
      title: map['title'] ?? '',
      instructions: map['instructions'] ?? '',
      dueDate: parseDate(map['dueDate'] ?? map['due_date']),
      createdAt: parseDate(map['createdAt'] ?? map['created_at']),
    );
  }
}

class SubmissionModel {
  final String id;
  final String assignmentId;
  final String lessonId;
  final String userId;
  final String userName;
  final String userEmail;
  final String submissionType; // 'text' or 'file'
  final String text;
  final String fileUrl;
  final String fileName;
  final DateTime submittedAt;
  final String status; // 'pending' or 'graded'
  final String grade;
  final String feedback;

  SubmissionModel({
    required this.id,
    required this.assignmentId,
    required this.lessonId,
    required this.userId,
    required this.userName,
    required this.userEmail,
    required this.submissionType,
    this.text = '',
    this.fileUrl = '',
    this.fileName = '',
    required this.submittedAt,
    this.status = 'pending',
    this.grade = '',
    this.feedback = '',
  });

  Map<String, dynamic> toMap() {
    return {
      'assignmentId': assignmentId,
      'lessonId': lessonId,
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'submissionType': submissionType,
      'text': text,
      'fileUrl': fileUrl,
      'fileName': fileName,
      'submittedAt': submittedAt.toIso8601String(),
      'status': status,
      'grade': grade,
      'feedback': feedback,
    };
  }

  factory SubmissionModel.fromMap(Map<String, dynamic> map, String id) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }
    return SubmissionModel(
      id: id,
      assignmentId: map['assignmentId'] ?? map['assignment_id'] ?? '',
      lessonId: map['lessonId'] ?? map['lesson_id'] ?? '',
      userId: map['userId'] ?? map['user_id'] ?? '',
      userName: map['userName'] ?? map['user_name'] ?? '',
      userEmail: map['userEmail'] ?? map['user_email'] ?? '',
      submissionType: map['submissionType'] ?? map['submission_type'] ?? 'text',
      text: map['text'] ?? map['submission_text'] ?? '',
      fileUrl: map['fileUrl'] ?? map['file_url'] ?? '',
      fileName: map['fileName'] ?? map['file_name'] ?? '',
      submittedAt: parseDate(map['submittedAt'] ?? map['submitted_at']),
      status: map['status'] ?? 'pending',
      grade: map['grade'] ?? '',
      feedback: map['feedback'] ?? '',
    );
  }
}
