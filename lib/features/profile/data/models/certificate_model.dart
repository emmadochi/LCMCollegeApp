class CertificateModel {
  final String id;
  final String userId;
  final String userName;
  final String courseId;
  final String courseName;
  final DateTime completionDate;

  CertificateModel({
    required this.id,
    required this.userId,
    required this.userName,
    required this.courseId,
    required this.courseName,
    required this.completionDate,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'userName': userName,
      'courseId': courseId,
      'courseName': courseName,
      'completionDate': completionDate.toIso8601String(),
    };
  }

  factory CertificateModel.fromMap(Map<String, dynamic> map, String id) {
    return CertificateModel(
      id: id,
      userId: map['userId'] ?? '',
      userName: map['userName'] ?? '',
      courseId: map['courseId'] ?? '',
      courseName: map['courseName'] ?? '',
      completionDate: DateTime.parse(map['completionDate'] ?? DateTime.now().toIso8601String()),
    );
  }
}
