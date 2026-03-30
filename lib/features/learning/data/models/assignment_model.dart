import 'package:cloud_firestore/cloud_firestore.dart';

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

  factory AssignmentModel.fromMap(Map<String, dynamic> map, String id) {
    return AssignmentModel(
      id: id,
      lessonId: map['lessonId'] ?? '',
      courseId: map['courseId'] ?? '',
      title: map['title'] ?? '',
      instructions: map['instructions'] ?? '',
      dueDate: (map['dueDate'] as Timestamp?)?.toDate() ?? DateTime.now(),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
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
      'submittedAt': Timestamp.fromDate(submittedAt),
      'status': status,
      'grade': grade,
      'feedback': feedback,
    };
  }

  factory SubmissionModel.fromMap(Map<String, dynamic> map, String id) {
    return SubmissionModel(
      id: id,
      assignmentId: map['assignmentId'] ?? '',
      lessonId: map['lessonId'] ?? '',
      userId: map['userId'] ?? '',
      userName: map['userName'] ?? '',
      userEmail: map['userEmail'] ?? '',
      submissionType: map['submissionType'] ?? 'text',
      text: map['text'] ?? '',
      fileUrl: map['fileUrl'] ?? '',
      fileName: map['fileName'] ?? '',
      submittedAt: (map['submittedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      status: map['status'] ?? 'pending',
      grade: map['grade'] ?? '',
      feedback: map['feedback'] ?? '',
    );
  }
}
